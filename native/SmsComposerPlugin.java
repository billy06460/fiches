package com.prejmarseille.missions;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.provider.Telephony;
import android.telephony.SmsManager;
import android.telephony.SubscriptionManager;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Envoi automatique de MMS (PDF en pièce jointe) vers des adresses e-mail,
 * sans ouvrir l'application Messages. Repris du Carnet de bord.
 */
@CapacitorPlugin(
    name = "SmsComposer",
    permissions = { @Permission(alias = "sms", strings = { Manifest.permission.SEND_SMS }) }
)
public class SmsComposerPlugin extends Plugin {

    private static final String GOOGLE_MESSAGES = "com.google.android.apps.messaging";
    private static final String[] KNOWN_SMS_APPS = {
        GOOGLE_MESSAGES,
        "com.samsung.android.messaging",
        "com.android.mms",
        "com.android.messaging"
    };
    private static final int MAX_ATTEMPTS = 3;
    private static final long RETRY_DELAY_MS = 10000;
    private static final long DELAY_BETWEEN_MMS_MS = 5000;
    private static final long MMS_TIMEOUT_MS = 180000;

    private static final class MmsJob {
        PluginCall call;
        SmsManager sm;
        List<String> recipients;
        String subject;
        String body;
        List<MmsPduBuilder.Part> parts;
        int maxSize;
        JSArray results = new JSArray();
        final Handler handler = new Handler(Looper.getMainLooper());
        int lastSize = 0;
    }

    // ------------------------------------------------------------------ envoi automatique

    @PluginMethod
    public void sendMms(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermissionCallback");
            return;
        }
        doSendMms(call);
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            doSendMms(call);
        } else {
            call.reject(
                "Autorisation « Envoyer des SMS » refusée. Activez-la dans Paramètres > Applications > PREJ Missions > Autorisations.",
                "PERMISSION_DENIED"
            );
        }
    }

    private void doSendMms(PluginCall call) {
        List<String> recipients = new ArrayList<>();
        String subject = call.getString("subject", "");
        String body = call.getString("body", "");
        List<MmsPduBuilder.Part> parts = new ArrayList<>();
        try {
            JSArray to = call.getArray("to", new JSArray());
            for (int i = 0; i < to.length(); i++) {
                String r = to.getString(i).trim();
                if (!r.isEmpty()) recipients.add(r);
            }
            JSArray atts = call.getArray("attachments", new JSArray());
            for (int i = 0; i < atts.length(); i++) {
                JSONObject a = atts.getJSONObject(i);
                String name = asciiFileName(a.optString("name", "piece_" + (i + 1) + ".pdf"));
                String lower = name.toLowerCase();
                String type = lower.endsWith(".pdf") ? "application/pdf"
                    : lower.endsWith(".png") ? "image/png" : "image/jpeg";
                byte[] data = Base64.decode(a.getString("data"), Base64.DEFAULT);
                parts.add(new MmsPduBuilder.Part(type, name, data));
            }
        } catch (Exception e) {
            call.reject("Données du message invalides : " + e.getMessage(), e);
            return;
        }
        if (recipients.isEmpty()) {
            call.reject("Aucun destinataire.");
            return;
        }
        SmsManager sm;
        try {
            sm = getSmsManager();
        } catch (Exception e) {
            call.reject("Service MMS indisponible sur ce téléphone : " + e.getMessage(), e);
            return;
        }
        int maxSize = 0;
        try {
            Bundle cfg = sm.getCarrierConfigValues();
            if (cfg != null) maxSize = cfg.getInt("maxMessageSize", 0);
        } catch (Exception ignored) { }

        MmsJob job = new MmsJob();
        job.call = call;
        job.sm = sm;
        job.recipients = recipients;
        job.subject = subject;
        job.body = body;
        job.parts = parts;
        job.maxSize = maxSize;
        sendOne(job, 0, 1);
    }

    private SmsManager getSmsManager() {
        int subId = SubscriptionManager.getDefaultSmsSubscriptionId();
        if (Build.VERSION.SDK_INT >= 31) {
            SmsManager m = getContext().getSystemService(SmsManager.class);
            return subId != -1 ? m.createForSubscriptionId(subId) : m;
        }
        return subId != -1 ? SmsManager.getSmsManagerForSubscriptionId(subId) : SmsManager.getDefault();
    }

    private void sendOne(final MmsJob job, final int index, final int attempt) {
        final String to = job.recipients.get(index);
        final Context ctx = getContext();
        try {
            List<String> single = new ArrayList<>();
            single.add(to);
            byte[] pdu = MmsPduBuilder.build(single, job.subject, job.body, job.parts);
            job.lastSize = pdu.length;
            if (job.maxSize > 0 && pdu.length > job.maxSize) {
                failOrRetry(job, index, attempt, -2,
                    "Message trop lourd pour l'opérateur (" + (pdu.length / 1024) + " Ko, maximum "
                        + (job.maxSize / 1024) + " Ko).", false);
                return;
            }
            File dir = new File(ctx.getCacheDir(), "mms_out");
            dir.mkdirs();
            File f = new File(dir, "send_" + System.currentTimeMillis() + "_" + index + "_" + attempt + ".pdu");
            try (FileOutputStream fos = new FileOutputStream(f)) {
                fos.write(pdu);
            }
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);

            long now = System.currentTimeMillis();
            String action = ctx.getPackageName() + ".MMS_SENT." + now + "." + index + "." + attempt;
            final boolean[] done = { false };
            final Runnable[] timeout = new Runnable[1];

            final BroadcastReceiver receiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context c, Intent intent) {
                    if (done[0]) return;
                    done[0] = true;
                    job.handler.removeCallbacks(timeout[0]);
                    try { ctx.unregisterReceiver(this); } catch (Exception ignored) { }
                    int code = getResultCode();
                    byte[] resp = null;
                    int http = 0;
                    try {
                        resp = intent.getByteArrayExtra("android.telephony.extra.MMS_DATA");
                        http = intent.getIntExtra("android.telephony.extra.MMS_HTTP_STATUS", 0);
                    } catch (Exception ignored) { }
                    int[] st = parseSendConfStatus(resp);
                    String confText = parseSendConfText(resp);
                    String detail = " [code " + code
                        + (http != 0 ? ", HTTP " + http : "")
                        + (st[1] == 1 ? ", statut 0x" + Integer.toHexString(st[0]).toUpperCase() : "")
                        + (confText != null ? ", « " + confText + " »" : "")
                        + ", " + (job.lastSize / 1024) + " Ko]";
                    if (code == Activity.RESULT_OK && (st[1] == 0 || st[0] == 0x80)) {
                        JSObject r = result(to, true, 0, null);
                        r.put("attempts", attempt);
                        r.put("detail", detail);
                        finishRecipient(job, index, r);
                    } else if (code == Activity.RESULT_OK) {
                        boolean transientError = (st[0] & 0xE0) == 0xC0;
                        failOrRetry(job, index, attempt, st[0], responseStatusText(st[0]) + detail, transientError);
                    } else {
                        failOrRetry(job, index, attempt, code, mmsErrorText(code) + detail, true);
                    }
                }
            };

            IntentFilter filter = new IntentFilter(action);
            if (Build.VERSION.SDK_INT >= 33) {
                ctx.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                ctx.registerReceiver(receiver, filter);
            }
            Intent sent = new Intent(action).setPackage(ctx.getPackageName());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
            int requestCode = (int) ((now + index * 7919L + attempt * 104729L) & 0x7FFFFFFL);
            PendingIntent pi = PendingIntent.getBroadcast(ctx, requestCode, sent, flags);

            timeout[0] = () -> {
                if (done[0]) return;
                done[0] = true;
                try { ctx.unregisterReceiver(receiver); } catch (Exception ignored) { }
                failOrRetry(job, index, attempt, -4,
                    "Pas de réponse du réseau après 3 minutes (données mobiles activées ?).", true);
            };
            job.handler.postDelayed(timeout[0], MMS_TIMEOUT_MS);

            try {
                job.sm.sendMultimediaMessage(ctx, uri, null, null, pi);
            } catch (Exception e) {
                if (done[0]) return;
                done[0] = true;
                job.handler.removeCallbacks(timeout[0]);
                try { ctx.unregisterReceiver(receiver); } catch (Exception ignored) { }
                failOrRetry(job, index, attempt, -5, "Envoi refusé par le système : " + e.getMessage(), true);
            }
        } catch (Exception e) {
            failOrRetry(job, index, attempt, -3, "Construction du MMS impossible : " + e.getMessage(), false);
        }
    }

    private void failOrRetry(final MmsJob job, final int index, final int attempt, int code, String msg, boolean retryable) {
        if (retryable && attempt < MAX_ATTEMPTS) {
            job.handler.postDelayed(() -> sendOne(job, index, attempt + 1), RETRY_DELAY_MS);
            return;
        }
        String to = job.recipients.get(index);
        finishRecipient(job, index, result(to, false, code, msg + (attempt > 1 ? " (" + attempt + " essais)" : "")));
    }

    private void finishRecipient(final MmsJob job, int index, JSObject r) {
        job.results.put(r);
        final int next = index + 1;
        if (next >= job.recipients.size()) {
            JSObject res = new JSObject();
            res.put("results", job.results);
            res.put("maxSize", job.maxSize);
            job.call.resolve(res);
        } else {
            job.handler.postDelayed(() -> sendOne(job, next, 1), DELAY_BETWEEN_MMS_MS);
        }
    }

    private static JSObject result(String to, boolean ok, int code, String error) {
        JSObject o = new JSObject();
        o.put("to", to);
        o.put("ok", ok);
        o.put("code", code);
        if (error != null) o.put("error", error);
        return o;
    }

    // ------------------------------------------------------------------ lecture de la réponse opérateur

    private static int[] parseSendConfStatus(byte[] d) {
        int[] r = { 0, 0 };
        if (d == null) return r;
        int i = 0;
        try {
            while (i < d.length) {
                int h = d[i++] & 0xFF;
                if (h == 0x92) {
                    r[0] = d[i] & 0xFF;
                    r[1] = 1;
                    return r;
                }
                int n = skipHeaderValue(d, i, h);
                if (n < 0) break;
                i = n;
            }
        } catch (Exception ignored) { }
        return r;
    }

    private static String parseSendConfText(byte[] d) {
        if (d == null) return null;
        int i = 0;
        try {
            while (i < d.length) {
                int h = d[i++] & 0xFF;
                if (h == 0x93) {
                    int first = d[i] & 0xFF;
                    int start;
                    int end;
                    if (first < 31) {
                        start = i + 1;
                        end = start + first;
                        start++; // jeu de caractères
                    } else if (first == 31) {
                        return null;
                    } else {
                        start = i;
                        end = i;
                        while (end < d.length && d[end] != 0) end++;
                    }
                    if (start < d.length && (d[start] & 0xFF) == 0x7F) start++;
                    int stop = start;
                    while (stop < end && stop < d.length && d[stop] != 0) stop++;
                    String s = new String(d, start, Math.max(0, stop - start), StandardCharsets.UTF_8).trim();
                    return s.isEmpty() ? null : s;
                }
                int n = skipHeaderValue(d, i, h);
                if (n < 0) break;
                i = n;
            }
        } catch (Exception ignored) { }
        return null;
    }

    private static int skipHeaderValue(byte[] d, int i, int h) {
        switch (h) {
            case 0x8B: // Message-ID
            case 0x98: // Transaction-ID
                while (i < d.length && d[i] != 0) i++;
                return i + 1;
            case 0x8C:
            case 0x8D:
            case 0x92:
                return i + 1;
            case 0x93: {
                int v = d[i] & 0xFF;
                if (v < 31) return i + 1 + v;
                while (i < d.length && d[i] != 0) i++;
                return i + 1;
            }
            default:
                return -1;
        }
    }

    private static String mmsErrorText(int code) {
        switch (code) {
            case 2: return "Réglages MMS (APN) de l'opérateur invalides.";
            case 3: return "Connexion au serveur MMS de l'opérateur impossible.";
            case 4: return "Le serveur MMS de l'opérateur a refusé le message.";
            case 5: return "Erreur de lecture du message.";
            case 6: return "Erreur temporaire, réessayez.";
            case 7: return "Configuration MMS de l'opérateur introuvable.";
            case 8: return "Pas de données mobiles : activez-les puis réessayez.";
            default: return "Échec de l'envoi du MMS (code " + code + ").";
        }
    }

    private static String responseStatusText(int st) {
        switch (st) {
            case 130: case 225:
                return "Service refusé par l'opérateur (option MMS vers email non autorisée ?).";
            case 131: case 226:
                return "L'opérateur juge le format du message incorrect.";
            case 132: case 193: case 227:
                return "L'opérateur ne reconnaît pas l'adresse du destinataire.";
            case 134: case 195:
                return "Problème réseau chez l'opérateur.";
            case 135: case 229:
                return "Contenu refusé par l'opérateur (taille ou type de pièce jointe).";
            case 192:
                return "Refus temporaire de l'opérateur.";
            case 235:
                return "Crédit insuffisant pour l'envoi de MMS.";
            default:
                return "Message refusé par l'opérateur.";
        }
    }

    private static String asciiFileName(String s) {
        String r = Normalizer.normalize(s, Normalizer.Form.NFD)
            .replaceAll("[\\p{M}]", "")
            .replaceAll("[^A-Za-z0-9._-]+", "_");
        return r.isEmpty() ? "piece.pdf" : r;
    }

    // ------------------------------------------------------------------ secours : ouvrir Messages

    @PluginMethod
    public void composeSms(final PluginCall call) {
        final String to = call.getString("to", "").trim();
        final String body = call.getString("body", "");
        JSArray atts = call.getArray("attachments", new JSArray());
        final ArrayList<Uri> uris = new ArrayList<>();
        try {
            File dir = new File(getContext().getCacheDir(), "sms_attachments");
            if (dir.exists()) {
                File[] old = dir.listFiles();
                if (old != null) for (File o : old) o.delete();
            }
            dir.mkdirs();
            String authority = getContext().getPackageName() + ".fileprovider";
            for (int i = 0; i < atts.length(); i++) {
                JSONObject a = atts.getJSONObject(i);
                String name = a.optString("name", "piece_" + (i + 1)).replaceAll("[\\\\/:*?\"<>|]+", "-");
                byte[] data = Base64.decode(a.getString("data"), Base64.DEFAULT);
                File f = new File(dir, name);
                try (FileOutputStream fos = new FileOutputStream(f)) {
                    fos.write(data);
                }
                uris.add(FileProvider.getUriForFile(getContext(), authority, f));
            }
        } catch (Exception e) {
            call.reject("Préparation des pièces jointes impossible : " + e.getMessage(), e);
            return;
        }
        try {
            ClipboardManager cm = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null && !to.isEmpty()) {
                cm.setPrimaryClip(ClipData.newPlainText("Destinataire", to.replace(",", ", ")));
            }
        } catch (Exception ignored) { }

        getActivity().runOnUiThread(() -> {
            LinkedHashSet<String> pkgs = new LinkedHashSet<>();
            String def = Telephony.Sms.getDefaultSmsPackage(getContext());
            if (def != null) pkgs.add(def);
            Collections.addAll(pkgs, KNOWN_SMS_APPS);
            String last = "";
            for (String p : pkgs) {
                try {
                    Intent intent = (GOOGLE_MESSAGES.equals(p) && uris.size() <= 1)
                        ? buildSendToIntent(to, body, uris, p)
                        : buildIntent(to, body, uris, p);
                    getActivity().startActivity(intent);
                    JSObject r = new JSObject();
                    r.put("package", p);
                    call.resolve(r);
                    return;
                } catch (ActivityNotFoundException e) {
                    last = e.getMessage();
                } catch (Exception e) {
                    last = e.getMessage();
                }
            }
            call.reject("Aucune application SMS n'a accepté le message : " + last);
        });
    }

    private Intent buildIntent(String to, String body, ArrayList<Uri> uris, String pkg) {
        Intent intent;
        if (uris.isEmpty()) {
            intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(to, "@+.,")));
        } else {
            intent = new Intent(uris.size() == 1 ? Intent.ACTION_SEND : Intent.ACTION_SEND_MULTIPLE);
            intent.setType("application/pdf");
            if (uris.size() == 1) {
                intent.putExtra(Intent.EXTRA_STREAM, uris.get(0));
            } else {
                intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
            }
            ClipData clip = ClipData.newRawUri("", uris.get(0));
            for (int k = 1; k < uris.size(); k++) clip.addItem(new ClipData.Item(uris.get(k)));
            intent.setClipData(clip);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
        intent.putExtra("address", to);
        String[] list = to.split(",");
        intent.putExtra("addresses", list);
        intent.putExtra(Intent.EXTRA_EMAIL, list);
        intent.putExtra(Intent.EXTRA_PHONE_NUMBER, to);
        intent.putExtra("sms_body", body);
        intent.putExtra(Intent.EXTRA_TEXT, body);
        intent.setPackage(pkg);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return intent;
    }

    private Intent buildSendToIntent(String to, String body, ArrayList<Uri> uris, String pkg) {
        Intent intent = new Intent(Intent.ACTION_SENDTO,
            Uri.parse((uris.isEmpty() ? "smsto:" : "mmsto:") + Uri.encode(to, "@+.,")));
        intent.putExtra("sms_body", body);
        intent.putExtra(Intent.EXTRA_TEXT, body);
        if (!uris.isEmpty()) {
            intent.putExtra(Intent.EXTRA_STREAM, uris.get(0));
            intent.setClipData(ClipData.newRawUri("", uris.get(0)));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
        intent.setPackage(pkg);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return intent;
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            JSObject r = new JSObject();
            r.put("sdk", Build.VERSION.SDK_INT);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Ouverture des réglages impossible : " + e.getMessage(), e);
        }
    }
}
