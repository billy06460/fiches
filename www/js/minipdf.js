// MiniPDF - a tiny, dependency-free PDF writer.
// Supports: multi-page A4, Helvetica/Helvetica-Bold text, filled/stroked
// rectangles, lines, and embedded baseline JPEG images (DCTDecode).
// No network, no external library: works fully offline.
// Coordinate system exposed to callers: millimetres, origin top-left
// (matches the mental model used throughout the app's PDF layout code).

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MiniPDF = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MM = 2.83464567; // PDF points per millimetre
  var PAGE_W_MM = 210;
  var PAGE_H_MM = 297;

  var HELV_WIDTHS = {
    32:278,33:278,34:355,35:556,36:556,37:889,38:667,39:191,40:333,41:333,42:389,43:584,
    44:278,45:333,46:278,47:278,48:556,49:556,50:556,51:556,52:556,53:556,54:556,55:556,
    56:556,57:556,58:278,59:278,60:584,61:584,62:584,63:556,64:1015,65:667,66:667,67:722,
    68:722,69:667,70:611,71:778,72:722,73:278,74:500,75:667,76:556,77:833,78:722,79:778,
    80:667,81:778,82:722,83:667,84:611,85:722,86:667,87:944,88:667,89:667,90:611,91:278,
    92:278,93:278,94:469,95:556,96:333,97:556,98:556,99:500,100:556,101:556,102:278,
    103:556,104:556,105:222,106:222,107:500,108:222,109:833,110:556,111:556,112:556,
    113:556,114:333,115:500,116:278,117:556,118:500,119:722,120:500,121:500,122:500,
    123:334,124:260,125:334,126:584
  };
  var HELV_BOLD_WIDTHS = {
    32:278,33:333,34:474,35:556,36:556,37:889,38:722,39:238,40:333,41:333,42:389,43:584,
    44:278,45:333,46:278,47:278,48:556,49:556,50:556,51:556,52:556,53:556,54:556,55:556,
    56:556,57:556,58:333,59:333,60:584,61:584,62:584,63:611,64:975,65:722,66:722,67:722,
    68:722,69:667,70:611,71:778,72:722,73:278,74:556,75:722,76:611,77:833,78:722,79:778,
    80:667,81:778,82:722,83:667,84:611,85:722,86:667,87:944,88:667,89:667,90:611,91:333,
    92:278,93:333,94:584,95:556,96:333,97:556,98:611,99:556,100:611,101:556,102:333,
    103:611,104:611,105:278,106:278,107:556,108:278,109:889,110:611,111:611,112:611,
    113:611,114:389,115:556,116:333,117:611,118:556,119:778,120:556,121:556,122:500,
    123:389,124:280,125:389,126:584
  };

  function widthTable(bold){ return bold ? HELV_BOLD_WIDTHS : HELV_WIDTHS; }

  function sanitizeText(s){
    if (s == null) return s;
    var out = String(s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2014\u2013]/g, '-')
      .replace(/[\u2019\u2018]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/\u00b0/g, '')
      // All Unicode space variants (incl. the narrow no-break space used by
      // toLocaleString('fr-FR') as a thousands separator, U+202F) -> plain space.
      .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, ' ');
    // Safety net: any character our single-byte Latin1 writer can't represent
    // would otherwise be silently truncated (high byte dropped), which can
    // corrupt output into an unrelated ASCII character. Replace instead of
    // corrupting.
    var result = '';
    for (var i = 0; i < out.length; i++){
      var code = out.charCodeAt(i);
      result += code > 255 ? ' ' : out[i];
    }
    return result;
  }

  function textWidthMm(str, fontSizePt, bold){
    var table = widthTable(bold);
    var units = 0;
    for (var i = 0; i < str.length; i++){
      var code = str.charCodeAt(i);
      units += table[code] !== undefined ? table[code] : 556;
    }
    var pt = units / 1000 * fontSizePt;
    return pt / MM;
  }

  function strToBytes(str){
    var arr = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i) & 0xFF;
    return arr;
  }
  function concatBytes(list){
    var total = 0;
    for (var i = 0; i < list.length; i++) total += list[i].length;
    var out = new Uint8Array(total);
    var offset = 0;
    for (var j = 0; j < list.length; j++){ out.set(list[j], offset); offset += list[j].length; }
    return out;
  }
  function pad10(n){
    var s = String(Math.max(0, Math.floor(n)));
    while (s.length < 10) s = '0' + s;
    return s;
  }
  function pdfEscape(str){
    return String(str).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
  function fmt(n){
    return (Math.round(n * 1000) / 1000).toString();
  }

  function getJpegDimensions(bytes){
    var i = 2;
    while (i < bytes.length - 1){
      if (bytes[i] !== 0xFF){ i++; continue; }
      var marker = bytes[i + 1];
      if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)){
        i += 2; continue;
      }
      if (marker === 0xD9) break;
      if (i + 3 >= bytes.length) break;
      var segLen = (bytes[i + 2] << 8) | bytes[i + 3];
      var isSOF = marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
      if (isSOF){
        var height = (bytes[i + 5] << 8) | bytes[i + 6];
        var width = (bytes[i + 7] << 8) | bytes[i + 8];
        return { width: width, height: height };
      }
      i += 2 + segLen;
    }
    return { width: 0, height: 0 };
  }

  function base64ToBytes(b64){
    var binary;
    if (typeof atob === 'function'){
      binary = atob(b64);
    } else {
      binary = Buffer.from(b64, 'base64').toString('binary');
    }
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function MiniPDF(){
    this._pending = [];
    this._nextId = 1;
    this._images = {};
    this._pages = [];
    this._page = null;

    this._fillColor = [0, 0, 0];
    this._drawColor = [0, 0, 0];
    this._textColor = [0, 0, 0];
    this._fontBold = false;
    this._fontSize = 12;
    this._lineWidth = 0.2;

    var self = this;
    this.internal = {
      pageSize: {
        getWidth: function(){ return PAGE_W_MM; },
        getHeight: function(){ return PAGE_H_MM; }
      },
      getNumberOfPages: function(){ return self._pages.length; }
    };

    this.addPage();
  }

  MiniPDF.prototype._addObject = function (body) {
    var id = this._nextId++;
    this._pending.push({ id: id, body: body });
    return id;
  };
  MiniPDF.prototype._reserveId = function () {
    return this._nextId++;
  };
  MiniPDF.prototype._addObjectWithId = function (id, body) {
    this._pending.push({ id: id, body: body });
  };

  MiniPDF.prototype.addPage = function () {
    var page = { content: [], imageIds: {} };
    this._pages.push(page);
    this._page = page;
    return this;
  };
  MiniPDF.prototype.setPage = function (n) {
    this._page = this._pages[n - 1];
    return this;
  };

  MiniPDF.prototype.setLineWidth = function (w) { this._lineWidth = w; return this; };
  MiniPDF.prototype.setFillColor = function (r, g, b) { this._fillColor = [r, g, b]; return this; };
  MiniPDF.prototype.setDrawColor = function (r, g, b) { this._drawColor = [r, g, b]; return this; };
  MiniPDF.prototype.setTextColor = function (r, g, b) { this._textColor = [r, g, b]; return this; };
  MiniPDF.prototype.setFontSize = function (n) { this._fontSize = n; return this; };
  MiniPDF.prototype.setFont = function (name, style) { this._fontBold = (style === 'bold'); return this; };

  MiniPDF.prototype.getTextWidth = function (text) {
    return textWidthMm(sanitizeText(String(text)), this._fontSize, this._fontBold);
  };

  MiniPDF.prototype.splitTextToSize = function (text, maxWidthMm) {
    var words = sanitizeText(String(text)).split(/\s+/);
    var lines = [];
    var current = '';
    for (var i = 0; i < words.length; i++){
      var candidate = current ? current + ' ' + words[i] : words[i];
      if (textWidthMm(candidate, this._fontSize, this._fontBold) > maxWidthMm && current){
        lines.push(current);
        current = words[i];
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  };

  function toPt(mmVal){ return mmVal * MM; }
  function yToPt(yMm){ return (PAGE_H_MM - yMm) * MM; }

  MiniPDF.prototype._push = function (line) {
    this._page.content.push(line);
  };

  MiniPDF.prototype.line = function (x1, y1, x2, y2) {
    var c = this._drawColor;
    this._push((c[0]/255).toFixed(3) + ' ' + (c[1]/255).toFixed(3) + ' ' + (c[2]/255).toFixed(3) + ' RG');
    this._push(fmt(this._lineWidth * MM) + ' w');
    this._push(fmt(toPt(x1)) + ' ' + fmt(yToPt(y1)) + ' m ' + fmt(toPt(x2)) + ' ' + fmt(yToPt(y2)) + ' l S');
    return this;
  };

  MiniPDF.prototype.rect = function (x, y, w, h, style) {
    return this._drawRect(x, y, w, h, style);
  };
  MiniPDF.prototype.roundedRect = function (x, y, w, h, rx, ry, style) {
    return this._drawRect(x, y, w, h, style);
  };
  MiniPDF.prototype._drawRect = function (x, y, w, h, style) {
    style = style || 'S';
    var doFill = style.indexOf('F') !== -1;
    var doStroke = style.indexOf('S') !== -1 || style.indexOf('D') !== -1;
    if (!doFill && !doStroke) doStroke = true;

    var fc = this._fillColor, dc = this._drawColor;
    if (doFill){
      this._push((fc[0]/255).toFixed(3) + ' ' + (fc[1]/255).toFixed(3) + ' ' + (fc[2]/255).toFixed(3) + ' rg');
    }
    if (doStroke){
      this._push((dc[0]/255).toFixed(3) + ' ' + (dc[1]/255).toFixed(3) + ' ' + (dc[2]/255).toFixed(3) + ' RG');
      this._push(fmt(this._lineWidth * MM) + ' w');
    }
    var op = doFill && doStroke ? 'B' : (doFill ? 'f' : 'S');
    var xPt = toPt(x), wPt = toPt(w), hPt = toPt(h);
    var yPt = yToPt(y) - hPt;
    this._push(fmt(xPt) + ' ' + fmt(yPt) + ' ' + fmt(wPt) + ' ' + fmt(hPt) + ' re ' + op);
    return this;
  };

  MiniPDF.prototype.text = function (text, x, y, opts) {
    opts = opts || {};
    var rawLines = Array.isArray(text) ? text : [String(text)];
    var lines = rawLines.map(sanitizeText);
    var lineHeightMm = (this._fontSize * 1.15) / MM;
    var tc = this._textColor;
    var fontTag = this._fontBold ? '/F2' : '/F1';
    for (var i = 0; i < lines.length; i++){
      var line = lines[i];
      var drawX = x;
      if (opts.align === 'center'){
        drawX = x - this.getTextWidth(line) / 2;
      } else if (opts.align === 'right'){
        drawX = x - this.getTextWidth(line);
      }
      var xPt = toPt(drawX);
      var yPt = yToPt(y + i * lineHeightMm);
      this._push('BT');
      this._push((tc[0]/255).toFixed(3) + ' ' + (tc[1]/255).toFixed(3) + ' ' + (tc[2]/255).toFixed(3) + ' rg');
      this._push(fontTag + ' ' + fmt(this._fontSize) + ' Tf');
      this._push(fmt(xPt) + ' ' + fmt(yPt) + ' Td');
      this._push('(' + pdfEscape(line) + ') Tj');
      this._push('ET');
    }
    return this;
  };

  function detectImageFormat(bytes){
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8) return 'jpeg';
    if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
    return 'unknown';
  }

  // imgData is either:
  //  - a data URL string (embedded as JPEG via DCTDecode; format is verified via
  //    magic bytes first, since some WebViews silently return PNG bytes even when
  //    canvas.toDataURL('image/jpeg') was requested)
  //  - a pre-decoded raw-pixel object { rgbFlate: Uint8Array, width, height } or
  //    { rgbRaw: Uint8Array, width, height }, used as a fallback for any image
  //    that isn't actually JPEG (see preparePhotoForPdf in the app code)
  MiniPDF.prototype.addImage = function (imgData, format, x, y, w, h) {
    var imgId;
    var isString = typeof imgData === 'string';
    var cached = isString ? this._images[imgData] : null;
    if (cached){
      imgId = cached.id;
    } else if (isString){
      var comma = imgData.indexOf(',');
      var b64 = comma !== -1 ? imgData.slice(comma + 1) : imgData;
      var bytes = base64ToBytes(b64);
      var realFormat = detectImageFormat(bytes);
      if (realFormat !== 'jpeg'){
        // Not actually a JPEG despite being passed as one: skip rather than
        // emit a PDF with a mismatched filter (which some strict readers reject).
        return this;
      }
      var dims = getJpegDimensions(bytes);
      var dict = '<< /Type /XObject /Subtype /Image /Width ' + dims.width +
        ' /Height ' + dims.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8' +
        ' /Filter /DCTDecode /Length ' + bytes.length + ' >>\nstream\n';
      var body = concatBytes([strToBytes(dict), bytes, strToBytes('\nendstream')]);
      imgId = this._addObject(body);
      this._images[imgData] = { id: imgId };
    } else if (imgData && imgData.rgbFlate){
      var dict2 = '<< /Type /XObject /Subtype /Image /Width ' + imgData.width +
        ' /Height ' + imgData.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8' +
        ' /Filter /FlateDecode /Length ' + imgData.rgbFlate.length + ' >>\nstream\n';
      var body2 = concatBytes([strToBytes(dict2), imgData.rgbFlate, strToBytes('\nendstream')]);
      imgId = this._addObject(body2);
    } else if (imgData && imgData.rgbRaw){
      var dict3 = '<< /Type /XObject /Subtype /Image /Width ' + imgData.width +
        ' /Height ' + imgData.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8' +
        ' /Length ' + imgData.rgbRaw.length + ' >>\nstream\n';
      var body3 = concatBytes([strToBytes(dict3), imgData.rgbRaw, strToBytes('\nendstream')]);
      imgId = this._addObject(body3);
    } else {
      return this;
    }
    this._page.imageIds['Im' + imgId] = imgId;
    var xPt = toPt(x), wPt = toPt(w), hPt = toPt(h);
    var yPt = yToPt(y) - hPt;
    this._push('q ' + fmt(wPt) + ' 0 0 ' + fmt(hPt) + ' ' + fmt(xPt) + ' ' + fmt(yPt) + ' cm /Im' + imgId + ' Do Q');
    return this;
  };

  MiniPDF.prototype.output = function (type) {
    var self = this;

    var fontRegularId = this._addObject(strToBytes(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
    ));
    var fontBoldId = this._addObject(strToBytes(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    ));

    var pagesId = this._reserveId();

    var pageIds = [];
    this._pages.forEach(function (page) {
      var streamStr = page.content.join('\n');
      var streamBytes = strToBytes(streamStr);
      var contentBody = concatBytes([
        strToBytes('<< /Length ' + streamBytes.length + ' >>\nstream\n'),
        streamBytes,
        strToBytes('\nendstream')
      ]);
      var contentId = self._addObject(contentBody);

      var imgRefs = Object.keys(page.imageIds).map(function (name) {
        return '/' + name + ' ' + page.imageIds[name] + ' 0 R';
      }).join(' ');

      var resources = '<< /Font << /F1 ' + fontRegularId + ' 0 R /F2 ' + fontBoldId + ' 0 R >>' +
        (imgRefs ? ' /XObject << ' + imgRefs + ' >>' : '') + ' >>';

      var pageDict = '<< /Type /Page /Parent ' + pagesId + ' 0 R /Resources ' + resources +
        ' /MediaBox [0 0 ' + fmt(PAGE_W_MM * MM) + ' ' + fmt(PAGE_H_MM * MM) + ']' +
        ' /Contents ' + contentId + ' 0 R >>';
      var pageId = self._addObject(strToBytes(pageDict));
      pageIds.push(pageId);
    });

    var pagesBody = '<< /Type /Pages /Kids [' +
      pageIds.map(function (id) { return id + ' 0 R'; }).join(' ') +
      '] /Count ' + pageIds.length + ' >>';
    this._addObjectWithId(pagesId, strToBytes(pagesBody));

    var catalogId = this._addObject(strToBytes(
      '<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>'
    ));

    var header = strToBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    var chunks = [header];
    var offsets = {};
    var pos = header.length;
    this._pending.forEach(function (obj) {
      offsets[obj.id] = pos;
      var pre = strToBytes(obj.id + ' 0 obj\n');
      var post = strToBytes('\nendobj\n');
      chunks.push(pre, obj.body, post);
      pos += pre.length + obj.body.length + post.length;
    });

    var xrefStart = pos;
    var maxId = this._nextId - 1;
    var xrefBody = '0000000000 65535 f \n';
    for (var id = 1; id <= maxId; id++) {
      var off = offsets[id] !== undefined ? offsets[id] : 0;
      xrefBody += pad10(off) + ' 00000 n \n';
    }
    chunks.push(strToBytes('xref\n0 ' + (maxId + 1) + '\n' + xrefBody));

    var trailerStr = 'trailer\n<< /Size ' + (maxId + 1) + ' /Root ' + catalogId +
      ' 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF';
    chunks.push(strToBytes(trailerStr));

    var full = concatBytes(chunks);

    if (type === 'bytes') return full;
    if (typeof Blob !== 'undefined') return new Blob([full], { type: 'application/pdf' });
    return full;
  };

  return MiniPDF;
}));
