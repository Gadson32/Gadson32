package com.gadson32.videocall;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CallForegroundPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
