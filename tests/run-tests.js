#!/usr/bin/gjs

"use strict";

const GLib = imports.gi.GLib;
const System = imports.system;

const REPO_ROOT = GLib.getenv("APPLET_TEST_ROOT") ||
    GLib.path_get_dirname(typeof __dirname !== "undefined" ? __dirname : imports.searchPath[0]);
const APPLET_DIR = GLib.build_filenamev([REPO_ROOT, "modern-sound@husain-anabtawi.com"]);

imports.searchPath.unshift(REPO_ROOT);
imports.searchPath.unshift(APPLET_DIR);

const { setupCinnamonMocks, createMockStream, createMockOutput } = require("./mocks/cinnamon");
setupCinnamonMocks();

const { volumeIconName } = require("./../modern-sound@husain-anabtawi.com/widgets/volume");
const { applyDeviceIcon, deviceDisplayIcon } = require("./../modern-sound@husain-anabtawi.com/widgets/deviceDisplay");
const { MasterVolumeItem } = require("./../modern-sound@husain-anabtawi.com/widgets/masterVolumeItem");
const { OutputDeviceItem } = require("./../modern-sound@husain-anabtawi.com/widgets/outputDeviceItem");
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

function createMockApplet(output) {
    return {
        _volumeNorm: 65536,
        _output: output || null,
        _updatePanelIcon() {},
        toggleSoundMute() {},
        toggleInputMute() {},
        openSettings() {}
    };
}

function createMockControl() {
    return new imports.gi.Cvc.MixerControl({ name: "test" });
}

section("deviceDisplayIcon");
assertEqual(
    deviceDisplayIcon({ get_icon_name: () => "audio-headphones-symbolic" }),
    "audio-headphones-symbolic",
    "uses device icon name"
);
assertEqual(deviceDisplayIcon({}), "audio-speakers-symbolic", "falls back to speakers");

section("applyDeviceIcon");
{
    const icon = { gicon: null, icon_name: "", icon_type: null };
    const gicon = { name: "mock-gicon" };
    applyDeviceIcon(icon, { get_gicon: () => gicon });
    assert(icon.gicon === gicon, "uses device gicon when available");
    assertEqual(icon.icon_type, imports.gi.St.IconType.FULLCOLOR, "gicon uses fullcolor");

    applyDeviceIcon(icon, { get_icon_name: () => "video-display" });
    assertEqual(icon.icon_name, "video-display", "uses non-symbolic icon name");
    assertEqual(icon.icon_type, imports.gi.St.IconType.FULLCOLOR, "non-symbolic name uses fullcolor");

    applyDeviceIcon(icon, { get_icon_name: () => "audio-headphones-symbolic" });
    assertEqual(icon.icon_name, "audio-headphones-symbolic", "uses symbolic icon name");
    assertEqual(icon.icon_type, imports.gi.St.IconType.SYMBOLIC, "symbolic name uses symbolic type");

    applyDeviceIcon(icon, null);
    assertEqual(icon.icon_name, "audio-speakers-symbolic", "null device uses speakers fallback");
    assertEqual(icon.icon_type, imports.gi.St.IconType.SYMBOLIC, "fallback uses symbolic type");
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

section("MasterVolumeItem icon mute toggle");
if (volumeItem) {
    const stream = createMockStream({ volume: 32768, volume_max: 65536, is_muted: false });
    volumeItem.connectStream(stream);
    volumeItem._icon.emit("button-press-event", { get_button: () => 1 });
    assert(stream.is_muted === true, "icon click mutes");
    volumeItem._icon.emit("button-press-event", { get_button: () => 1 });
    assert(stream.is_muted === false, "icon click again unmutes");
}

section("OutputDeviceItem construction");
let outputItem;
try {
    outputItem = new OutputDeviceItem(createMockApplet());
    assert(outputItem._nameLabel !== undefined, "creates device name label");
    assert(outputItem._chevron !== undefined, "creates chevron");
    assertEqual(outputItem._nameLabel.text, "No output device", "default name when no output");
} catch (e) {
    failed++;
    printerr(`  ✗ OutputDeviceItem construction threw: ${e}`);
}

section("OutputDeviceItem device list");
if (outputItem) {
    const builtIn = createMockOutput(0, "Built-in Audio", "Analog Stereo");
    const hdmi = createMockOutput(1, "HDMI / DisplayPort", "Digital Stereo (HDMI)");
    const control = createMockControl();
    const applet = createMockApplet(builtIn);

    outputItem = new OutputDeviceItem(applet);
    outputItem.bindControl(control);
    control.addOutput(0, builtIn);
    control.addOutput(1, hdmi);

    assertEqual(outputItem._devices.length, 2, "tracks two output devices");
    assert(outputItem._chevron.visible === true, "shows chevron with multiple devices");
    assertEqual(outputItem._nameLabel.text, "Built-in Audio", "header shows active device");

    outputItem._syncActiveDevice();
    const activeRow = outputItem._devices.find((entry) => entry.id === 0);
    assert(activeRow !== undefined, "finds active device row");
    assertEqual(activeRow.row._radio.icon_name, "radio-checked-symbolic", "marks active row");

    const hdmiRow = outputItem._devices.find((entry) => entry.id === 1);
    assertEqual(hdmiRow.row._radio.icon_name, "radio-off-symbolic", "inactive row is off");

    hdmiRow.row.emit("button-press-event", { get_button: () => 1 });
    assert(control._activeOutput === hdmi, "row click switches output");
    assertEqual(control._activeOutput.description, "HDMI / DisplayPort", "active output updated");

    outputItem._header.emit("button-release-event", { get_button: () => 1 });
    assert(outputItem._listBox.visible === true, "header expands device list");
    outputItem._header.emit("button-release-event", { get_button: () => 1 });
    assert(outputItem._listBox.visible === false, "header collapses device list");
}

section("OutputDeviceItem single device");
try {
    const device = createMockOutput(0, "USB DAC", "Analog Stereo");
    const control = createMockControl();
    const item = new OutputDeviceItem(createMockApplet(device));
    item.bindControl(control);
    control.addOutput(0, device);
    assert(item._chevron.visible === false, "hides chevron with one device");
} catch (e) {
    failed++;
    printerr(`  ✗ OutputDeviceItem single device threw: ${e}`);
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
    assert(instance._outputDevice !== undefined, "applet has output device switcher");
    assert(instance._quickActions !== undefined, "applet has quick actions");
    assert(instance._menu._items.length >= 4, "menu has volume, output, separator, and actions");
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
