#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const APPLET_DIR = path.join(ROOT, "modern-sound@husain-anabtawi.com");

const { setupCinnamonMocks, createMockStream, createMockOutput } = require("./mocks/cinnamon");
setupCinnamonMocks();

const cinnamonImports = globalThis.imports;

const cache = new Map();

function loadModule(relativePath) {
    let filePath = path.resolve(APPLET_DIR, relativePath);
    if (!filePath.endsWith(".js"))
        filePath += ".js";
    if (cache.has(filePath))
        return cache.get(filePath);

    const source = fs.readFileSync(filePath, "utf8");
    const mod = { exports: {} };
    const sandbox = {
        imports: cinnamonImports,
        _: globalThis._,
        global: globalThis.global,
        module: mod,
        exports: mod.exports,
        require: (request) => {
            if (request.startsWith(".")) {
                const appletRelative = request.replace(/^\.\//, "");
                return loadModule(appletRelative);
            }
            throw new Error(`Unsupported require: ${request}`);
        },
        console
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    if (typeof sandbox.main === "function" && !mod.exports.main)
        mod.exports.main = sandbox.main;
    cache.set(filePath, mod.exports);
    return mod.exports;
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`  ✓ ${message}`);
    } else {
        failed++;
        console.error(`  ✗ ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    assert(actual === expected, `${message} (expected ${expected}, got ${actual})`);
}

function section(title) {
    console.log(`\n${title}`);
}

const { volumeIconName } = loadModule("widgets/volume.js");
const { applyDeviceIcon, deviceDisplayIcon } = loadModule("widgets/deviceDisplay.js");
const { MasterVolumeItem } = loadModule("widgets/masterVolumeItem.js");
const { OutputDeviceItem } = loadModule("widgets/outputDeviceItem.js");
const { QuickActionsItem } = loadModule("widgets/quickActionsItem.js");

function createMockApplet(output) {
    return {
        _volumeNorm: 65536,
        _output: output || null,
        _updatePanelIcon() {}
    };
}

function createMockControl() {
    return new cinnamonImports.gi.Cvc.MixerControl({ name: "test" });
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
    assertEqual(icon.icon_type, cinnamonImports.gi.St.IconType.FULLCOLOR, "gicon uses fullcolor");

    applyDeviceIcon(icon, { get_icon_name: () => "video-display" });
    assertEqual(icon.icon_name, "video-display", "uses non-symbolic icon name");
    assertEqual(icon.icon_type, cinnamonImports.gi.St.IconType.FULLCOLOR, "non-symbolic name uses fullcolor");

    applyDeviceIcon(icon, { get_icon_name: () => "audio-headphones-symbolic" });
    assertEqual(icon.icon_name, "audio-headphones-symbolic", "uses symbolic icon name");
    assertEqual(icon.icon_type, cinnamonImports.gi.St.IconType.SYMBOLIC, "symbolic name uses symbolic type");

    applyDeviceIcon(icon, null);
    assertEqual(icon.icon_name, "audio-speakers-symbolic", "null device uses speakers fallback");
    assertEqual(icon.icon_type, cinnamonImports.gi.St.IconType.SYMBOLIC, "fallback uses symbolic type");
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
    assertEqual(volumeItem._percentLabel.text, "0%", "default percent is 0%");
} catch (e) {
    failed++;
    console.error(`  ✗ MasterVolumeItem construction threw: ${e.message}`);
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
    console.error(`  ✗ OutputDeviceItem construction threw: ${e.message}`);
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
    console.error(`  ✗ OutputDeviceItem single device threw: ${e.message}`);
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
    console.error(`  ✗ QuickActionsItem construction threw: ${e.message}`);
}

section("applet.js smoke test");
try {
    const appletModule = loadModule("applet.js");
    assert(typeof appletModule.main === "function", "applet exports main()");

    const metadata = { uuid: "modern-sound@husain-anabtawi.com" };
    const instance = appletModule.main(metadata, 3, 32, 1);
    assert(instance != null, "main() returns applet instance");
    assert(instance._masterVolume !== undefined, "applet has master volume");
    assert(instance._outputDevice !== undefined, "applet has output device switcher");
    assert(instance._quickActions !== undefined, "applet has quick actions");
    assert(instance._menu._items.length >= 4, "menu has volume, output, separator, and actions");
} catch (e) {
    failed++;
    console.error(`  ✗ applet.js smoke test threw: ${e.message}`);
    if (e.stack)
        console.error(e.stack);
}

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0)
    process.exit(1);

console.log("All tests passed — safe to reload Cinnamon.");
