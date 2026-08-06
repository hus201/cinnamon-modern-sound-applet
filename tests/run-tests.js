#!/usr/bin/gjs

"use strict";

const GLib = imports.gi.GLib;
const System = imports.system;

const REPO_ROOT = GLib.getenv("APPLET_TEST_ROOT") ||
    GLib.path_get_dirname(typeof __dirname !== "undefined" ? __dirname : imports.searchPath[0]);
const APPLET_DIR = GLib.build_filenamev([REPO_ROOT, "modern-sound@husain-anabtawi.com"]);
const RUN_TESTS_PATH = GLib.build_filenamev([REPO_ROOT, "tests", "run-tests.js"]);

(function setupRequire() {
    const cache = {};

    function readFile(filePath) {
        let path = filePath;
        if (!path.endsWith(".js"))
            path += ".js";

        const [ok, contents] = GLib.file_get_contents(path);
        if (!ok)
            throw new Error(`Cannot load module: ${path}`);

        let source;
        if (typeof contents === "string") {
            source = contents;
        } else if (typeof TextDecoder !== "undefined") {
            source = new TextDecoder("utf-8").decode(contents);
        } else if (imports.byteArray) {
            source = imports.byteArray.toString(contents);
        } else {
            source = String.fromCharCode.apply(null, contents);
        }

        if (source.startsWith("#!"))
            source = source.replace(/^[^\n]*\n/, "");

        return source;
    }

    function resolveModule(request, parentPath) {
        if (!request.startsWith("."))
            throw new Error(`Unsupported require: ${request}`);

        if (parentPath && parentPath.indexOf(APPLET_DIR) === 0) {
            return GLib.build_filenamev([APPLET_DIR, request.replace(/^\.\//, "")]);
        }

        const parentDir = GLib.path_get_dirname(parentPath || RUN_TESTS_PATH);
        const joined = GLib.build_filenamev([parentDir, request]);
        return GLib.canonicalize_filename(joined, parentDir);
    }

    function loadModule(filePath, parentPath) {
        let resolved = filePath;
        if (!resolved.endsWith(".js"))
            resolved += ".js";

        if (cache[resolved])
            return cache[resolved].exports;

        const source = readFile(resolved);
        const module = { exports: {} };
        const exports = module.exports;

        function localRequire(request) {
            const nextPath = resolveModule(request, resolved);
            return loadModule(nextPath, resolved);
        }

        const evaluator = new Function(
            "imports", "_", "global", "module", "exports", "require", "print", "printerr",
            `${source}\n//# sourceURL=${resolved}`
        );

        evaluator(
            globalThis.imports || imports,
            globalThis._ || ((text) => text),
            globalThis.global || globalThis,
            module,
            exports,
            localRequire,
            print,
            printerr
        );

        cache[resolved] = module;
        return module.exports;
    }

    globalThis.require = (request) => {
        const resolved = resolveModule(request, RUN_TESTS_PATH);
        return loadModule(resolved, RUN_TESTS_PATH);
    };
})();

imports.searchPath.unshift(REPO_ROOT);
imports.searchPath.unshift(APPLET_DIR);

const { setupCinnamonMocks, createMockStream, createMockOutput, createMockInput, createMockAppStream } = require("./mocks/cinnamon");
setupCinnamonMocks();

const { volumeIconName, micIconName } = require("./../modern-sound@husain-anabtawi.com/utils/volume-icon-resolver");
const { applyDeviceIcon, deviceDisplayIcon } = require("./../modern-sound@husain-anabtawi.com/utils/device-icon-resolver");
const {
    VOLUME_ADJUSTMENT_STEP,
    snapVolumeToNorm,
    adjustStreamVolume,
    volumePercent,
    sliderScrollStepRatio
} = require("./../modern-sound@husain-anabtawi.com/utils/volume-math");
const { MasterVolumeItem, MicVolumeItem } = require("./../modern-sound@husain-anabtawi.com/widgets/stream-volume-item");
const { OutputDeviceItem, InputDeviceItem } = require("./../modern-sound@husain-anabtawi.com/widgets/device-picker-item");
const { ApplicationsItem } = require("./../modern-sound@husain-anabtawi.com/widgets/applications-item");
const { AppStreamItem } = require("./../modern-sound@husain-anabtawi.com/widgets/app-stream-item");
const { appStreamLabel, applyAppStreamIcon } = require("./../modern-sound@husain-anabtawi.com/widgets/app-display");
const { QuickActionsItem } = require("./../modern-sound@husain-anabtawi.com/widgets/quick-actions-item");
const {
    connectOveramplificationHandler,
    disconnectOveramplificationHandler,
    onOveramplificationChange
} = require("./../modern-sound@husain-anabtawi.com/handlers/on-overamplification-change");
const {
    adjustMasterVolume,
    adjustMicVolume,
    onIconScrollEvent
} = require("./../modern-sound@husain-anabtawi.com/handlers/on-icon-scroll-handler");
const { volumeOsdIconName, volumeOsdLevel, micOsdIconName } = require("./../modern-sound@husain-anabtawi.com/utils/volume-osd");
const {
    executeMiddleClickAction,
    resolveMiddleClickAction,
    onAppletMiddleClicked
} = require("./../modern-sound@husain-anabtawi.com/handlers/on-icon-middle-click-handler");

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

function createMockApplet(output, input, options = {}) {
    const volumeNorm = options.volumeNorm ?? 65536;
    const allowOveramplification = options.allowOveramplification ?? false;
    return {
        _volumeNorm: volumeNorm,
        _allowOveramplification: allowOveramplification,
        _masterVolumeMax: allowOveramplification ? Math.round(volumeNorm * 1.5) : volumeNorm,
        _output: output || null,
        _input: input || null,
        playVolumeChangeSound: options.playVolumeChangeSound !== false,
        showVolumeOsdOnScroll: options.showVolumeOsdOnScroll !== false,
        _updatePanelIcon() {},
        _syncMuteStates() {}
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

section("volumeOsdIconName");
assertEqual(volumeOsdIconName(0, 65536, true), "audio-volume-muted-symbolic", "osd muted");
assertEqual(volumeOsdIconName(10000, 65536, false), "audio-volume-low-symbolic", "osd low");
assertEqual(volumeOsdIconName(32768, 65536, false), "audio-volume-medium-symbolic", "osd medium");
assertEqual(volumeOsdIconName(60000, 65536, false), "audio-volume-high-symbolic", "osd high");
assertEqual(volumeOsdIconName(90000, 98304, false), "audio-volume-high-symbolic", "osd high at overamplified max");

section("volumeOsdLevel");
{
    const norm = 65536;
    const max = Math.round(norm * 1.5);
    assertEqual(volumeOsdLevel(norm / 2, norm, false), 50, "osd level at 50%");
    assertEqual(volumeOsdLevel(norm, norm, false), 100, "osd level at 100%");
    assertEqual(volumeOsdLevel(norm, max, false), 67, "osd level at 100% on extended range");
    assertEqual(volumeOsdLevel(Math.round(norm * 1.05), max, false), 70, "osd level at 105%");
    assertEqual(volumeOsdLevel(max, max, false), 100, "osd level at 150%");
    assertEqual(volumeOsdLevel(0, norm, true), 0, "osd level when muted");
}

section("micOsdIconName");
assertEqual(micOsdIconName(0, 65536, true), "microphone-sensitivity-muted-symbolic", "mic osd muted");
assertEqual(micOsdIconName(32768, 65536, false), "microphone-sensitivity-medium-symbolic", "mic osd medium");

section("micIconName");
assertEqual(micIconName(0, true), "xsi-microphone-sensitivity-muted", "mic muted");
assertEqual(micIconName(0.1, false), "xsi-microphone-sensitivity-low", "mic low");
assertEqual(micIconName(0.5, false), "xsi-microphone-sensitivity-medium", "mic medium");
assertEqual(micIconName(0.9, false), "xsi-microphone-sensitivity-high", "mic high");

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
    imports.ui.main.soundManager.reset();
    volumeItem._onChanged(0.5);
    assertEqual(volumeItem._percentLabel.text, "50%", "dragging to 50% updates label");
    assert(stream.is_muted === false, "dragging up unmutes");
    assertEqual(imports.ui.main.soundManager.playCount, 1, "master slider plays volume sound by default");

    volumeItem._applet.playVolumeChangeSound = false;
    imports.ui.main.soundManager.reset();
    volumeItem._onChanged(0.25);
    assertEqual(imports.ui.main.soundManager.playCount, 0, "master slider skips sound when disabled");
}

section("MasterVolumeItem slider scroll");
if (volumeItem) {
    const Clutter = imports.gi.Clutter;
    const norm = 65536;
    const stream = createMockStream({ volume: norm / 2, volume_max: norm, is_muted: false });
    volumeItem._applet.scrollStep = 10;
    volumeItem.connectStream(stream);
    volumeItem._value = 0.5;
    volumeItem._onScrollEvent(volumeItem._slider, {
        get_scroll_direction: () => Clutter.ScrollDirection.UP
    });
    assertEqual(volumeItem._value, 0.6, "menu slider scroll uses configured step");
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

section("MasterVolumeItem overamplification");
{
    const norm = 65536;
    const max = Math.round(norm * 1.5);
    const applet = createMockApplet(null, null, { allowOveramplification: true });
    const item = new MasterVolumeItem(applet);
    const stream = createMockStream({ volume: max, volume_max: norm, is_muted: false });
    item.connectStream(stream);
    assertEqual(item._percentLabel.text, "150%", "sync shows 150% at max overamplified volume");
    assertEqual(item._icon.icon_name, "xsi-audio-volume-high", "sync picks high icon at max");

    item._onChanged(2 / 3);
    assertEqual(stream.volume, norm, "slider at 100% mark sets norm volume");
    assertEqual(item._percentLabel.text, "100%", "100% mark shows 100% label");
    assertEqual(item._markPosition, 1 / 1.5, "shows 100% mark when overamplification enabled");

    const appletNoOveramp = createMockApplet(null, null, { allowOveramplification: false });
    const itemNoOveramp = new MasterVolumeItem(appletNoOveramp);
    itemNoOveramp.connectStream(createMockStream({ volume: norm, volume_max: norm, is_muted: false }));
    assertEqual(itemNoOveramp._markPosition, 0, "hides 100% mark when overamplification disabled");
}

section("MicVolumeItem construction");
let micItem;
try {
    micItem = new MicVolumeItem(createMockApplet());
    assert(micItem._percentLabel !== undefined, "creates mic percent label");
    assert(micItem._slider !== undefined, "creates mic slider");
    assert(micItem._icon !== undefined, "creates mic icon");
    assertEqual(micItem._percentLabel.text, "0%", "mic default percent is 0%");
} catch (e) {
    failed++;
    printerr(`  ✗ MicVolumeItem construction threw: ${e}`);
}

section("MicVolumeItem sync");
if (micItem) {
    const stream = createMockStream({ volume: 32768, volume_max: 65536, is_muted: false });
    micItem.connectStream(stream);
    assertEqual(micItem._percentLabel.text, "50%", "mic sync shows 50% at half volume");
    assertEqual(micItem._icon.icon_name, "xsi-microphone-sensitivity-medium", "mic sync picks medium icon");

    stream.is_muted = true;
    micItem._sync();
    assertEqual(micItem._percentLabel.text, "0%", "mic sync shows 0% when muted");
}

section("MicVolumeItem value change");
if (micItem) {
    const stream = createMockStream({ volume: 0, volume_max: 65536, is_muted: true });
    micItem.connectStream(stream);
    imports.ui.main.soundManager.reset();
    micItem._onChanged(0.5);
    assertEqual(micItem._percentLabel.text, "50%", "mic dragging to 50% updates label");
    assert(stream.is_muted === false, "mic dragging up unmutes");
    assertEqual(imports.ui.main.soundManager.playCount, 0, "mic slider never plays volume sound");
}

section("MicVolumeItem icon mute toggle");
if (micItem) {
    const stream = createMockStream({ volume: 32768, volume_max: 65536, is_muted: false });
    micItem.connectStream(stream);
    micItem._icon.emit("button-press-event", { get_button: () => 1 });
    assert(stream.is_muted === true, "mic icon click mutes");
    micItem._icon.emit("button-press-event", { get_button: () => 1 });
    assert(stream.is_muted === false, "mic icon click again unmutes");
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
    assertEqual(outputItem._subtitleLabel.text, "Output device", "header shows output device label");

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
    assert(item.actor.visible === true, "shows single output device by default");

    item._applet.hideSingleOutputDevice = true;
    item._updateVisibility();
    assert(item.actor.visible === false, "hides single output device when setting enabled");

    control.addOutput(1, createMockOutput(1, "HDMI", "Digital"));
    assert(item.actor.visible === true, "shows output device row with multiple devices");
} catch (e) {
    failed++;
    printerr(`  ✗ OutputDeviceItem single device threw: ${e}`);
}

section("InputDeviceItem construction");
let inputItem;
try {
    inputItem = new InputDeviceItem(createMockApplet());
    assert(inputItem._nameLabel !== undefined, "creates input device name label");
    assert(inputItem._chevron !== undefined, "creates input chevron");
    assertEqual(inputItem._nameLabel.text, "No input device", "default name when no input");
} catch (e) {
    failed++;
    printerr(`  ✗ InputDeviceItem construction threw: ${e}`);
}

section("InputDeviceItem device list");
if (inputItem) {
    const builtIn = createMockInput(0, "Built-in Microphone", "Analog Mono");
    const usbMic = createMockInput(1, "USB Microphone", "Digital Mono");
    const control = createMockControl();
    const applet = createMockApplet(null, builtIn);

    inputItem = new InputDeviceItem(applet);
    inputItem.bindControl(control);
    control.addInput(0, builtIn);
    control.addInput(1, usbMic);

    assertEqual(inputItem._devices.length, 2, "tracks two input devices");
    assert(inputItem._chevron.visible === true, "shows input chevron with multiple devices");
    assertEqual(inputItem._nameLabel.text, "Built-in Microphone", "header shows active input device");
    assertEqual(inputItem._subtitleLabel.text, "Input device", "header shows input device label");

    inputItem._syncActiveDevice();
    const activeRow = inputItem._devices.find((entry) => entry.id === 0);
    assert(activeRow !== undefined, "finds active input device row");
    assertEqual(activeRow.row._radio.icon_name, "radio-checked-symbolic", "marks active input row");

    const usbRow = inputItem._devices.find((entry) => entry.id === 1);
    assertEqual(usbRow.row._radio.icon_name, "radio-off-symbolic", "inactive input row is off");

    usbRow.row.emit("button-press-event", { get_button: () => 1 });
    assert(control._activeInput === usbMic, "input row click switches device");
    assertEqual(control._activeInput.description, "USB Microphone", "active input updated");

    inputItem._header.emit("button-release-event", { get_button: () => 1 });
    assert(inputItem._listBox.visible === true, "input header expands device list");
    inputItem._header.emit("button-release-event", { get_button: () => 1 });
    assert(inputItem._listBox.visible === false, "input header collapses device list");
}

section("InputDeviceItem single device");
try {
    const device = createMockInput(0, "Headset Mic", "Analog Mono");
    const control = createMockControl();
    const item = new InputDeviceItem(createMockApplet(null, device));
    item.bindControl(control);
    control.addInput(0, device);
    assert(item._chevron.visible === false, "hides input chevron with one device");
    assert(item.actor.visible === true, "shows single input device by default");

    item._applet.hideSingleInputDevice = true;
    item._updateVisibility();
    assert(item.actor.visible === false, "hides single input device when setting enabled");
} catch (e) {
    failed++;
    printerr(`  ✗ InputDeviceItem single device threw: ${e}`);
}

section("appStreamLabel");
assertEqual(appStreamLabel({ name: "firefox" }), "Firefox", "capitalizes app name");

section("applyAppStreamIcon");
{
    const icon = { gicon: null, icon_name: "", icon_type: null };
    applyAppStreamIcon(icon, { name: "Firefox", icon_name: "audio" });
    assertEqual(icon.icon_name, "firefox", "maps Firefox icon");
    assertEqual(icon.icon_type, imports.gi.St.IconType.FULLCOLOR, "app icons use fullcolor");
}

section("AppStreamItem construction");
let appItem;
try {
    const stream = createMockAppStream({ name: "Firefox", volume: 32768, volume_max: 65536 });
    appItem = new AppStreamItem(createMockApplet(), stream);
    assertEqual(appItem._nameLabel.text, "Firefox", "shows app name");
    assertEqual(appItem._percentLabel.text, "50%", "shows stream volume");
} catch (e) {
    failed++;
    printerr(`  ✗ AppStreamItem construction threw: ${e}`);
}

section("AppStreamItem volume change");
if (appItem) {
    appItem._onChanged(0.25);
    assertEqual(appItem._percentLabel.text, "25%", "dragging updates app percent");
    assert(appItem._stream.is_muted === false, "dragging up unmutes app stream");
}

section("ApplicationsItem stream list");
try {
    const control = createMockControl();
    const apps = new ApplicationsItem(createMockApplet());
    apps.bindControl(control);
    assert(apps.actor.visible === false, "hidden with no playing apps");

    control.addStream(1, createMockAppStream({ name: "Firefox" }));
    control.addStream(2, createMockAppStream({ name: "Spotify", icon_name: "spotify" }));
    assertEqual(apps._streams.length, 2, "tracks two app streams");
    assert(apps.actor.visible === true, "shows section when apps are playing");

    control.removeStream(1);
    control.removeStream(2);
    assertEqual(apps._streams.length, 0, "removes app streams");
    assert(apps.actor.visible === false, "hides section when empty");
} catch (e) {
    failed++;
    printerr(`  ✗ ApplicationsItem stream list threw: ${e}`);
}

section("ApplicationsItem filters streams");
try {
    const control = createMockControl();
    const apps = new ApplicationsItem(createMockApplet());
    apps.bindControl(control);
    const virtualStream = createMockAppStream({ name: "Virtual", is_virtual: true });
    control.addStream(9, virtualStream);
    assertEqual(apps._streams.length, 0, "ignores virtual streams");
} catch (e) {
    failed++;
    printerr(`  ✗ ApplicationsItem filters streams threw: ${e}`);
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

section("volume-math");
{
    const norm = 65536;
    const stream = createMockStream({ volume: 32768, volume_max: 65536, is_muted: false });

    assertEqual(snapVolumeToNorm(norm, norm), norm, "snapVolumeToNorm keeps exact norm");
    assertEqual(snapVolumeToNorm(norm + 100, norm), norm, "snapVolumeToNorm snaps near norm to norm");
    assert(snapVolumeToNorm(norm / 2, norm) === norm / 2, "snapVolumeToNorm leaves distant values unchanged");

    assertEqual(volumePercent(norm / 2, norm, false), 50, "volumePercent is 50 at half volume");
    assertEqual(volumePercent(norm / 2, norm, true), 0, "volumePercent is 0 when muted");
    assertEqual(volumePercent(Math.round(norm * 1.5), norm, false), 150, "volumePercent supports overamplification");

    assertEqual(sliderScrollStepRatio(norm, norm, 5), 0.05, "slider scroll step at full max");
    assertEqual(
        sliderScrollStepRatio(norm, Math.round(norm * 1.5), 5),
        0.05 * norm / Math.round(norm * 1.5),
        "slider scroll step scales with overamplification max"
    );

    stream.volume = norm / 2;
    stream.is_muted = false;
    adjustStreamVolume(stream, norm, 1);
    assert(stream.volume > norm / 2, "adjustStreamVolume increases volume on scroll up");

    adjustStreamVolume(stream, norm, -1);
    assertEqual(stream.volume, norm / 2, "adjustStreamVolume decreases volume on scroll down");

    adjustStreamVolume(stream, norm, 1, undefined, 10);
    assertEqual(stream.volume, norm / 2 + norm / 10, "adjustStreamVolume uses custom scroll step");

    stream.volume = norm;
    stream.is_muted = false;
    adjustStreamVolume(stream, norm, 1, Math.round(norm * 1.5));
    assert(stream.volume > norm, "adjustStreamVolume allows volume above 100% with overamplification");

    stream.volume = norm * 0.02;
    stream.is_muted = false;
    adjustStreamVolume(stream, norm, -1);
    assertEqual(stream.volume, 0, "adjustStreamVolume clamps to zero");
    assert(stream.is_muted === true, "adjustStreamVolume mutes at zero");
}

section("on-overamplification-change");
{
    const norm = 65536;
    const output = createMockStream({ volume: Math.round(norm * 1.5), volume_max: norm, is_muted: false });
    let panelIconUpdated = false;
    let masterSynced = false;
    const applet = {
        _volumeNorm: norm,
        _allowOveramplification: false,
        _masterVolumeMax: norm,
        _output: output,
        _soundSettings: {
            get_boolean() {
                return applet._allowOveramplification;
            }
        },
        _masterVolume: { _sync() { masterSynced = true; } },
        _updatePanelIcon() { panelIconUpdated = true; }
    };

    assertEqual(applet._masterVolumeMax, norm, "_masterVolumeMax is norm when disabled");

    applet._allowOveramplification = true;
    onOveramplificationChange(applet);
    assertEqual(applet._masterVolumeMax, Math.round(norm * 1.5), "_masterVolumeMax is 150% when enabled");
    assertEqual(output.volume, Math.round(norm * 1.5), "enabled change keeps volume above 100%");
    assert(masterSynced, "enabled change syncs master volume");
    assert(panelIconUpdated, "enabled change updates panel icon");

    masterSynced = false;
    panelIconUpdated = false;
    applet._allowOveramplification = false;
    onOveramplificationChange(applet);
    assertEqual(applet._masterVolumeMax, norm, "_masterVolumeMax returns to norm when disabled");
    assertEqual(output.volume, norm, "disabled change clamps volume to 100%");
    assert(masterSynced, "disabled change syncs master volume");
    assert(panelIconUpdated, "disabled change updates panel icon");
}

section("on-overamplification-change lifecycle");
{
    const applet = {
        _volumeNorm: 65536,
        _masterVolumeMax: 65536,
        _output: null,
        _masterVolume: { _sync() {} },
        _updatePanelIcon() {}
    };
    connectOveramplificationHandler(applet);
    assert(applet._soundSettings !== null, "connects sound settings");
    assert(applet._soundSettingsChangedId !== undefined, "stores settings handler id");
    disconnectOveramplificationHandler(applet);
    assertEqual(applet._soundSettings, null, "clears sound settings on disconnect");
    assertEqual(applet._soundSettingsChangedId, 0, "clears settings handler id");
}

section("on-icon-scroll-handler");
try {
    const appletModule = require("./../modern-sound@husain-anabtawi.com/applet");
    const metadata = { uuid: "modern-sound@husain-anabtawi.com" };
    const instance = appletModule.main(metadata, 3, 32, 2);
    const output = instance._output;
    const norm = instance._volumeNorm;
    const step = norm * (instance.scrollStep / 100);
    imports.ui.main.osdWindowManager.reset();

    output.volume = norm / 2;
    output.is_muted = false;
    adjustMasterVolume(instance, 1);
    assertEqual(output.volume, norm / 2 + step, "scroll up increases master volume by 5%");

    assert(imports.ui.main.osdWindowManager.lastShow !== null, "scroll shows volume OSD");
    assertEqual(imports.ui.main.osdWindowManager.lastShow.level, 55, "OSD shows updated percent");
    assertEqual(
        imports.ui.main.osdWindowManager.lastShow.icon.name,
        "audio-volume-medium-symbolic",
        "OSD picks medium icon"
    );
    assertEqual(imports.ui.main.osdWindowManager.lastShow.monitorIndex, -1, "OSD shows on all monitors");

    adjustMasterVolume(instance, -1);
    assertEqual(output.volume, norm / 2, "scroll down decreases master volume by 5%");

    output.volume = step / 2;
    output.is_muted = false;
    adjustMasterVolume(instance, -1);
    assertEqual(output.volume, 0, "scroll down at low volume clamps to zero");
    assert(output.is_muted === true, "scroll down to zero mutes output");
    assertEqual(imports.ui.main.osdWindowManager.lastShow.level, 0, "OSD shows 0% when muted");
    assertEqual(
        imports.ui.main.osdWindowManager.lastShow.icon.name,
        "audio-volume-muted-symbolic",
        "OSD picks muted icon"
    );

    output.volume = norm / 2;
    output.is_muted = true;
    adjustMasterVolume(instance, 1);
    assert(output.is_muted === false, "scroll up unmutes output");

    instance._allowOveramplification = true;
    instance._masterVolumeMax = Math.round(norm * 1.5);
    output.volume = norm;
    output.is_muted = false;
    const levelAt100 = volumeOsdLevel(norm, instance._masterVolumeMax, false);
    adjustMasterVolume(instance, 1);
    assert(output.volume > norm, "scroll up allows overamplification when enabled");
    assert(
        imports.ui.main.osdWindowManager.lastShow.level > levelAt100,
        "OSD bar updates above 100% volume"
    );
    assertEqual(
        imports.ui.main.osdWindowManager.lastShow.level,
        volumeOsdLevel(output.volume, instance._masterVolumeMax, false),
        "OSD level tracks extended slider position"
    );

    imports.ui.main.soundManager.reset();
    instance.playVolumeChangeSound = false;
    output.volume = norm / 2;
    adjustMasterVolume(instance, 1);
    assertEqual(imports.ui.main.soundManager.playCount, 0, "scroll skips sound when disabled");
    assert(imports.ui.main.osdWindowManager.lastShow !== null, "OSD still shows when sound disabled");

    imports.ui.main.osdWindowManager.reset();
    instance.showVolumeOsdOnScroll = false;
    adjustMasterVolume(instance, 1);
    assertEqual(imports.ui.main.osdWindowManager.lastShow, null, "scroll skips OSD when disabled");

    const input = instance._input;
    const outputBeforeMicScroll = output.volume;
    imports.ui.main.osdWindowManager.reset();
    imports.ui.main.soundManager.reset();
    instance.showVolumeOsdOnScroll = true;
    input.volume = norm / 2;
    input.is_muted = false;
    adjustMicVolume(instance, 1);
    assertEqual(input.volume, norm / 2 + step, "mic scroll up increases input volume by 5%");
    assertEqual(output.volume, outputBeforeMicScroll, "mic scroll does not change output volume");
    assertEqual(imports.ui.main.soundManager.playCount, 0, "mic scroll never plays volume sound");
    assertEqual(
        imports.ui.main.osdWindowManager.lastShow.icon.name,
        "microphone-sensitivity-medium-symbolic",
        "mic scroll shows mic OSD icon"
    );

    const Clutter = imports.gi.Clutter;
    function mockScrollEvent(direction, shift) {
        return {
            _shift: shift,
            get_scroll_direction() {
                return direction;
            }
        };
    }

    output.volume = norm / 2;
    input.volume = norm / 4;
    input.is_muted = false;
    onIconScrollEvent(instance, null, mockScrollEvent(Clutter.ScrollDirection.UP, false));
    assert(output.volume > norm / 2, "plain scroll adjusts output");
    assertEqual(input.volume, norm / 4, "plain scroll leaves input unchanged");

    const outputVolumeBeforeShiftScroll = output.volume;
    onIconScrollEvent(instance, null, mockScrollEvent(Clutter.ScrollDirection.UP, true));
    assertEqual(output.volume, outputVolumeBeforeShiftScroll, "shift scroll leaves output unchanged");
    assert(input.volume > norm / 4, "shift scroll adjusts input");

    instance.scrollStep = 10;
    output.volume = norm / 2;
    adjustMasterVolume(instance, 1);
    assertEqual(output.volume, norm / 2 + norm / 10, "scroll uses configured step");
} catch (e) {
    failed++;
    printerr(`  ✗ on-icon-scroll-handler threw: ${e}`);
}

section("on-icon-middle-click-handler");
try {
    const output = createMockStream({ volume: 32768, volume_max: 65536, is_muted: false });
    const input = createMockStream({ volume: 32768, volume_max: 65536, is_muted: false });
    let outputToggles = 0;
    let inputToggles = 0;
    let playerToggles = 0;
    const applet = {
        _output: output,
        _input: input,
        middleClickAction: "mute",
        middleShiftClickAction: "in_mute",
        toggleSoundMute() {
            outputToggles++;
            output.change_is_muted(!output.is_muted);
        },
        toggleInputMute() {
            inputToggles++;
            input.change_is_muted(!input.is_muted);
        },
        toggleActivePlayer() {
            playerToggles++;
        }
    };

    executeMiddleClickAction(applet, "out_mute");
    assertEqual(outputToggles, 1, "out_mute toggles output once");
    assertEqual(inputToggles, 0, "out_mute does not toggle input");

    executeMiddleClickAction(applet, "in_mute");
    assertEqual(inputToggles, 1, "in_mute toggles input once");

    output.is_muted = false;
    input.is_muted = false;
    outputToggles = 0;
    inputToggles = 0;
    executeMiddleClickAction(applet, "mute");
    assertEqual(inputToggles, 1, "mute toggles input when both unmuted");
    assertEqual(outputToggles, 1, "mute toggles output when both unmuted");

    output.is_muted = true;
    input.is_muted = false;
    outputToggles = 0;
    inputToggles = 0;
    executeMiddleClickAction(applet, "mute");
    assertEqual(inputToggles, 0, "mute skips input when states differ");
    assertEqual(outputToggles, 1, "mute still toggles output when states differ");

    executeMiddleClickAction(applet, "player");
    assertEqual(playerToggles, 1, "player action toggles active player");

    applet.middleClickAction = "out_mute";
    applet.middleShiftClickAction = "in_mute";
    assertEqual(resolveMiddleClickAction(applet, false), "out_mute", "plain middle click uses middleClickAction");
    assertEqual(resolveMiddleClickAction(applet, true), "in_mute", "shift middle click uses middleShiftClickAction");

    outputToggles = 0;
    onAppletMiddleClicked(applet, { _shift: false });
    assertEqual(outputToggles, 1, "middle click event runs configured action");

    inputToggles = 0;
    onAppletMiddleClicked(applet, { _shift: true });
    assertEqual(inputToggles, 1, "shift middle click event runs shift action");
} catch (e) {
    failed++;
    printerr(`  ✗ on-icon-middle-click-handler threw: ${e}`);
    if (e.stack)
        printerr(e.stack);
}

section("applet panel tooltip");
try {
    const appletModule = require("./../modern-sound@husain-anabtawi.com/applet");
    const metadata = { uuid: "modern-sound@husain-anabtawi.com" };
    const instance = appletModule.main(metadata, 3, 32, 3);
    const norm = instance._volumeNorm;

    assertEqual(instance._appletTooltip, "Volume: 50%", "initial tooltip shows output volume percent");

    instance._output.volume = norm;
    instance._output.is_muted = false;
    instance._updatePanelIcon();
    assertEqual(instance._appletTooltip, "Volume: 100%", "tooltip shows 100% at full volume");

    instance._output.is_muted = true;
    instance._updatePanelIcon();
    assertEqual(instance._appletTooltip, "Volume: 0%", "tooltip shows 0% when muted");

    instance._allowOveramplification = true;
    instance._masterVolumeMax = Math.round(norm * 1.5);
    instance._output.volume = instance._masterVolumeMax;
    instance._output.is_muted = false;
    instance._updatePanelIcon();
    assertEqual(instance._appletTooltip, "Volume: 150%", "tooltip shows overamplified volume");

    instance._output = null;
    instance._updatePanelIcon();
    assertEqual(instance._appletTooltip, "Volume: 0%", "tooltip shows 0% without output");

    instance._output = createMockStream({ volume: norm / 2, volume_max: norm, is_muted: false });
    instance.tooltipShowVolume = false;
    instance._updatePanelIcon();
    assertEqual(instance._appletTooltip, "Sound", "tooltip shows Sound when volume disabled");
} catch (e) {
    failed++;
    printerr(`  ✗ applet panel tooltip threw: ${e}`);
}

section("applet.js smoke test");
try {
    const appletModule = require("./../modern-sound@husain-anabtawi.com/applet");
    assert(typeof appletModule.main === "function", "applet exports main()");

    const metadata = { uuid: "modern-sound@husain-anabtawi.com" };
    const instance = appletModule.main(metadata, 3, 32, 1);
    assert(instance !== null && instance !== undefined, "main() returns applet instance");
    assert(instance._masterVolume !== undefined, "applet has master volume");
    assert(instance._micVolume !== undefined, "applet has mic volume");
    assert(instance._inputDevice !== undefined, "applet has input device switcher");
    assert(instance._outputDevice !== undefined, "applet has output device switcher");
    assert(instance._applications !== undefined, "applet has applications section");
    assert(instance._quickActions !== undefined, "applet has quick actions");
    assert(instance._menu._items.length >= 8, "menu has volume, mic, output, input, separators, apps, and actions");
    assert(
        instance._menu.actor.styleClasses.includes("modern-sound-menu"),
        "menu has modern-sound-menu class"
    );
    instance.on_applet_removed_from_panel();
    assertEqual(instance._soundSettings, null, "remove disconnects overamplification settings");
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
