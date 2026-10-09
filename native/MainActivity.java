package com.prejmarseille.missions;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmsComposerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
