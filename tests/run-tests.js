#!/usr/bin/gjs

"use strict";

const GLib = imports.gi.GLib;
const System = imports.system;

const REPO_ROOT = GLib.getenv("APPLET_TEST_ROOT") ||
    GLib.path_get_dirname(typeof __dirname !== "undefined" ? __dirname : imports.searchPath[0]);
const APPLET_DIR = GLib.build_filenamev([REPO_ROOT, "modern-sound@husain-anabtawi.com"]);

imports.searchPath.unshift(REPO_ROOT);
imports.searchPath.unshift(APPLET_DIR);

const { setupCinnamonMocks, createMockStream } = require("./mocks/cinnamon");
setupCinnamonMocks();

const { volumeIconName } = require("./../modern-sound@husain-anabtawi.com/widgets/volume");
const { MasterVolumeItem } = require("./../modern-sound@husain-anabtawi.com/widgets/masterVolumeItem");
const { QuickActionsItem } = require("./../modern-sound@husain-anabtawi.com/widgets/quickActionsItem");

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        print(`  ✓ ${message}`);
    } else {
        failed++;
        printerr(`  ✗ ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    assert(actual === expected, `${message} (expected ${expected}, got ${actual})`);
}

function section(title) {
    print(`\n${title}`);
}

function createMockApplet() {
    return {
        _volumeNorm: 65536,
        _updatePanelIcon() {},
        toggleSoundMute() {},
        toggleInputMute() {},
        openSettings() {}
    };
}

section("volumeIconName");
assertEqual(volumeIconName(0, true), "xsi-audio-volume-muted", "muted");
assertEqual(volumeIconName(0.1, false), "xsi-audio-volume-low", "low");
assertEqual(volumeIconName(0.5, false), "xsi-audio-volume-medium", "medium");
assertEqual(volumeIconName(0.9, false), "xsi-audio-volume-high", "high");

section("MasterVolumeItem construction");
let volumeItem;
try {
    volumeItem = new MasterVolumeItem(createMockApplet());
    assert(volumeItem._percentLabel !== undefined, "creates percent label");
    assert(volumeItem._slider !== undefined, "creates slider");
    assert(volumeItem._icon !== undefined, "creates volume icon");
    assert(volumeItem._percentLabel.text === "0%", "default percent is 0%");
} catch (e) {
    failed++;
    printerr(`  ✗ MasterVolumeItem construction threw: ${e}`);
}

section("MasterVolumeItem sync");
if (volumeItem) {
    const stream = createMockStream({ volume: 32768, volume_max: 65536, is_muted: false });
    volumeItem.connectStream(stream);
    assertEqual(volumeItem._percentLabel.text, "50%", "sync shows 50% at half volume");
    assertEqual(volumeItem._icon.icon_name, "xsi-audio-volume-medium", "sync picks medium icon");

    stream.is_muted = true;
    volumeItem._sync();
    assertEqual(volumeItem._percentLabel.text, "0%", "sync shows 0% when muted");
}

section("MasterVolumeItem value change");
if (volumeItem) {
    const stream = createMockStream({ volume: 0, volume_max: 65536, is_muted: true });
    volumeItem.connectStream(stream);
    volumeItem._onChanged(0.5);
    assertEqual(volumeItem._percentLabel.text, "50%", "dragging to 50% updates label");
    assert(stream.is_muted === false, "dragging up unmutes");
}

section("QuickActionsItem construction");
try {
    const actions = new QuickActionsItem(createMockApplet());
    assert(actions._muteSoundBtn !== undefined, "creates mute sound button");
    assert(actions._muteMicBtn !== undefined, "creates mute mic button");
    assert(actions._settingsBtn !== undefined, "creates settings button");
    actions.setSoundMuted(true);
    actions.setInputMuted(true);
    assert(true, "mute state toggles without error");
} catch (e) {
    failed++;
    printerr(`  ✗ QuickActionsItem construction threw: ${e}`);
}

section("applet.js smoke test");
try {
    const appletModule = require("./../modern-sound@husain-anabtawi.com/applet");
    assert(typeof appletModule.main === "function", "applet exports main()");

    const metadata = { uuid: "modern-sound@husain-anabtawi.com" };
    const instance = appletModule.main(metadata, 3, 32, 1);
    assert(instance !== null && instance !== undefined, "main() returns applet instance");
    assert(instance._masterVolume !== undefined, "applet has master volume");
    assert(instance._quickActions !== undefined, "applet has quick actions");
    assert(instance._menu._items.length >= 3, "menu has volume, separator, and actions");
} catch (e) {
    failed++;
    printerr(`  ✗ applet.js smoke test threw: ${e}`);
    if (e.stack)
        printerr(e.stack);
}

print(`\n${"─".repeat(40)}`);
print(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0)
    System.exit(1);

print("All tests passed — safe to reload Cinnamon.");
