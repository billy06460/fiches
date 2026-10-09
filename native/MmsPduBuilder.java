package com.prejmarseille.missions;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Construit un PDU MMS « m-send-req » (OMA MMS 1.2, multipart/mixed).
 * Repris à l'identique du Carnet de bord.
 */
final class MmsPduBuilder {

    static final class Part {
        final String contentType;
        final String fileName;
        final byte[] data;

        Part(String contentType, String fileName, byte[] data) {
            this.contentType = contentType;
            this.fileName = fileName;
            this.data = data;
        }
    }

    private static final class Buf {
        private final ByteArrayOutputStream out = new ByteArrayOutputStream();

        void b(int v) { out.write(v & 0xFF); }

        void bytes(byte[] a) { out.write(a, 0, a.length); }

        int size() { return out.size(); }

        byte[] toBytes() { return out.toByteArray(); }

        void text(String s) {
            byte[] a = s.getBytes(StandardCharsets.UTF_8);
            if (a.length > 0 && (a[0] & 0xFF) >= 0x80) b(0x7F);
            bytes(a);
            b(0);
        }

        void quotedText(String s) {
            b(0x22);
            bytes(s.getBytes(StandardCharsets.UTF_8));
            b(0);
        }

        void uintvar(long v) {
            byte[] tmp = new byte[10];
            int n = 0;
            do {
                tmp[n++] = (byte) (v & 0x7F);
                v >>>= 7;
            } while (v != 0);
            for (int i = n - 1; i >= 0; i--) {
                int x = tmp[i] & 0x7F;
                if (i != 0) x |= 0x80;
                b(x);
            }
        }

        void valueLength(int len) {
            if (len < 31) {
                b(len);
            } else {
                b(31);
                uintvar(len);
            }
        }

        void longInteger(long v) {
            byte[] tmp = new byte[8];
            int n = 0;
            do {
                tmp[n++] = (byte) (v & 0xFF);
                v >>>= 8;
            } while (v != 0);
            b(n);
            for (int i = n - 1; i >= 0; i--) b(tmp[i]);
        }

        void encodedStringUtf8(String s) {
            Buf v = new Buf();
            v.b(0xEA);
            v.text(s);
            valueLength(v.size());
            bytes(v.toBytes());
        }
    }

    private MmsPduBuilder() {}

    static byte[] build(List<String> to, String subject, String text, List<Part> parts) {
        Buf p = new Buf();
        p.b(0x8C); p.b(0x80);                                   // X-Mms-Message-Type: m-send-req
        p.b(0x98); p.text("T" + Long.toHexString(System.currentTimeMillis())); // Transaction-ID
        p.b(0x8D); p.b(0x92);                                   // MMS-Version 1.2
        p.b(0x85); p.longInteger(System.currentTimeMillis() / 1000); // Date
        p.b(0x89); p.b(1); p.b(0x81);                           // From: insert-address-token
        for (String r : to) {
            String t = r.trim();
            if (t.isEmpty()) continue;
            p.b(0x97); p.text(t);                               // To
        }
        if (subject != null && !subject.isEmpty()) {
            p.b(0x96); p.encodedStringUtf8(subject);            // Subject
        }
        p.b(0x8A); p.b(0x80);                                   // Message-Class: personal
        p.b(0x86); p.b(0x81);                                   // Delivery-Report: no
        p.b(0x90); p.b(0x81);                                   // Read-Report: no
        p.b(0x84); p.b(0xA3);                                   // Content-Type: multipart/mixed

        List<byte[]> entries = new ArrayList<>();
        if (text != null && !text.isEmpty()) {
            Buf ct = new Buf();
            ct.b(0x83); ct.b(0x81); ct.b(0xEA);                 // text/plain; charset=utf-8
            Buf h = new Buf();
            h.valueLength(ct.size());
            h.bytes(ct.toBytes());
            h.b(0x8E); h.text("texte.txt");                     // Content-Location
            h.b(0xC0); h.quotedText("<texte>");                 // Content-ID
            entries.add(entry(h.toBytes(), text.getBytes(StandardCharsets.UTF_8)));
        }
        int i = 0;
        for (Part part : parts) {
            i++;
            Buf ct = new Buf();
            ct.text(part.contentType);
            ct.b(0x85); ct.text(part.fileName);                 // param Name
            Buf h = new Buf();
            h.valueLength(ct.size());
            h.bytes(ct.toBytes());
            h.b(0x8E); h.text(part.fileName);
            h.b(0xC0); h.quotedText("<piece" + i + ">");
            entries.add(entry(h.toBytes(), part.data));
        }
        p.uintvar(entries.size());
        for (byte[] e : entries) p.bytes(e);
        return p.toBytes();
    }

    private static byte[] entry(byte[] headers, byte[] data) {
        Buf b = new Buf();
        b.uintvar(headers.length);
        b.uintvar(data.length);
        b.bytes(headers);
        b.bytes(data);
        return b.toBytes();
    }
}
