#!/usr/bin/gjs

/**
 * Minimal Cinnamon / GJS mocks for offline applet tests.
 * Sets globalThis.imports and globalThis._ before loading applet modules.
 */

function createActor(name) {
    const actor = {
        name,
        styleClasses: [],
        children: [],
        reactive: true,
        can_focus: true,
        track_hover: true,
        text: "",
        icon_name: "",
        visible: true,
        width: 0,
        height: 24,
        set_size(w, h) {
            this.width = w;
            this.height = h;
        },
        add_style_class_name(cls) {
            this.styleClasses.push(cls);
        },
        add_actor(child) {
            this.children.push(child);
        },
        remove_actor() {},
        insert_child_at_index() {},
        set_child(child) {
            this.children = [child];
        },
        get_child() {
            return this.children[0];
        },
        get_preferred_width() {
            return [0, 100];
        },
        get_preferred_height() {
            return [0, 24];
        },
        queue_repaint() {},
        hide() {
            this.visible = false;
        },
        show() {
            this.visible = true;
        },
        connect(signal, handler) {
            this._handlers = this._handlers || {};
            this._handlers[signal] = handler;
            return 1;
        },
        disconnect() {},
        emit(signal, ...args) {
            if (this._handlers && this._handlers[signal])
                return this._handlers[signal](this, ...args);
        },
        destroy() {},
        change_style_pseudo_class() {},
        get_direction() {
            return 0;
        },
        clutterText: { ellipsize: 0 }
    };
    return actor;
}

class PopupBaseMenuItem {
    constructor(params) {
        this._init(params || {});
    }

    _init(params) {
        this.actor = createActor("PopupBaseMenuItem");
        this._children = [];
        this.params = params;
    }

    addActor(child) {
        this._children.push(child);
        if (child && child.actor)
            this.actor.children.push(child.actor || child);
        else
            this.actor.children.push(child);
    }

    removeActor() {}

    connect(event, handler) {
        this[`_${event}`] = handler;
        return 1;
    }

    disconnectAll() {}

    destroy() {
        this.disconnectAll();
    }
}

class PopupMenuSection {
    constructor() {
        this.actor = createActor("PopupMenuSection");
        this._items = [];
    }

    addMenuItem(item) {
        this._items.push(item);
    }
}

class PopupSeparatorMenuItem extends PopupBaseMenuItem {
    constructor() {
        super({ reactive: false });
        this._drawingArea = createActor("separator");
        this.addActor(this._drawingArea);
    }
}

class PopupSliderMenuItem extends PopupBaseMenuItem {
    constructor(value) {
        super({ activate: false, hover: false });
        this._value = value || 0;
        this._updating = false;
        this._handlers = {};
        this._slider = createActor("popup-slider-menu-item");
        this._actors = [this._slider];
        this.addActor(this._slider, { span: -1, expand: true });
    }

    removeActor(actor) {
        this._actors = this._actors.filter((a) => a !== actor);
    }

    addActor(child, params) {
        this._actors.push(child);
        this.actor.children.push(child);
    }

    setValue(value) {
        this._value = value;
    }

    set_mark(value) {
        this._markPosition = value;
    }

    connect(signal, handler) {
        this._handlers[signal] = handler;
        return 1;
    }

    emit(signal, ...args) {
        const handler = this._handlers[signal];
        if (handler)
            handler(this, ...args);
    }
}

class IconApplet {
    constructor(orientation, panelHeight, instanceId) {
        this._init(orientation, panelHeight, instanceId);
    }

    _init() {
        this.actor = createActor("IconApplet");
    }

    set_applet_icon_symbolic_name(name) {
        this._appletIconName = name;
    }

    set_applet_tooltip(text) {
        this._appletTooltip = text;
    }
}

class AppletPopupMenu {
    constructor(applet, orientation) {
        this.actor = createActor("AppletPopupMenu");
        this.box = createActor("menu-box");
        this._items = [];
    }

    setCustomStyleClass(className) {
        this.customStyleClass = className;
        this.actor.styleClasses = ["menu", className];
    }

    addMenuItem(item) {
        this._items.push(item);
    }

    toggle() {}
    close() {}
}

class PopupMenuManager {
    constructor(applet) {
        this.applet = applet;
    }

    addMenu() {}
}

class SliderWidget {
    constructor(value) {
        this._value = value || 0;
        this._handlers = {};
        this.actor = createActor("slider");
    }

    setValue(value) {
        this._value = value;
    }

    get value() {
        return this._value;
    }

    connect(signal, handler) {
        this._handlers[signal] = handler;
        return 1;
    }

    emit(signal, ...args) {
        if (this._handlers[signal])
            this._handlers[signal](this, ...args);
    }
}

class AppletSettings {
    constructor(target, uuid, instanceId) {
        this.target = target;
    }

    bind(key, prop, callback) {
        const defaults = {
            hideSingleOutputDevice: false,
            hideSingleInputDevice: false,
            playVolumeChangeSound: true,
            middleClickAction: "mute",
            middleShiftClickAction: "in_mute"
        };
        if (!(key in this.target))
            this.target[prop] = key in defaults ? defaults[key] : null;
        if (callback)
            callback();
    }
}

let MockMixerSinkInput;

function setupCinnamonMocks() {
    MockMixerSinkInput = class MixerSinkInput {};

    const StIconType = { SYMBOLIC: 1, FULLCOLOR: 2 };

    globalThis._ = (text) => text;
    globalThis.global = {
        log(message) {
            if (typeof printerr === "function")
                printerr(`${message}\n`);
            else
                console.log(message);
        },
        logError(message) {
            if (typeof printerr === "function")
                printerr(`${message}\n`);
            else
                console.error(message);
        }
    };

    const cinnamonImports = {
        ui: {
            applet: {
                IconApplet,
                AppletPopupMenu,
                TextIconApplet: IconApplet
            },
            popupMenu: {
                PopupBaseMenuItem,
                PopupSeparatorMenuItem,
                PopupSliderMenuItem,
                PopupMenuSection,
                PopupMenuManager
            },
            slider: {
                Slider: SliderWidget
            },
            settings: {
                AppletSettings
            },
            main: {
                keybindingManager: {
                    removeXletHotKey() {},
                    addXletHotKey() {}
                },
                soundManager: {
                    playCount: 0,
                    play() {
                        this.playCount++;
                    },
                    reset() {
                        this.playCount = 0;
                    }
                },
                osdWindowManager: {
                    show() {}
                }
            }
        },
        gi: {
            St: {
                Icon: class {
                    constructor(params) {
                        Object.assign(this, params);
                        this.gicon = params.gicon || null;
                        this.visible = params.visible !== false;
                        this.opacity = params.opacity !== undefined ? params.opacity : 255;
                        this.actor = createActor("icon");
                        this._handlers = {};
                    }

                    connect(signal, handler) {
                        this._handlers[signal] = handler;
                        return 1;
                    }

                    emit(signal, ...args) {
                        if (this._handlers[signal])
                            return this._handlers[signal](this, ...args);
                    }
                },
                Label: class {
                    constructor(params) {
                        this.text = params.text || "";
                        this.style_class = params.style_class;
                        this.x_align = params.x_align;
                        this.y_align = params.y_align;
                        this.visible = params.visible !== false;
                        this.clutter_text = { ellipsize: 0 };
                        this.clutterText = this.clutter_text;
                        this._style = "";
                        this.actor = createActor("label");
                    }

                    set_style(style) {
                        this._style = style;
                    }
                },
                BoxLayout: class {
                    constructor(params) {
                        Object.assign(this, params || {});
                        this._children = [];
                        this._handlers = {};
                        this.visible = params && params.visible !== undefined ?
                            params.visible :
                            true;
                    }

                    add_actor(child) {
                        this._children.push(child);
                    }

                    add(child, params) {
                        this._children.push({ child, params });
                    }

                    remove_actor(child) {
                        this._children = this._children.filter((entry) => {
                            if (entry && entry.child)
                                return entry.child !== child;
                            return entry !== child;
                        });
                    }

                    connect(signal, handler) {
                        this._handlers[signal] = handler;
                        return 1;
                    }

                    emit(signal, ...args) {
                        if (this._handlers[signal])
                            return this._handlers[signal](this, ...args);
                    }

                    destroy() {}
                    change_style_pseudo_class() {}
                },
                Table: class {
                    constructor(params) {
                        Object.assign(this, params || {});
                        this._children = [];
                    }

                    add(child, params) {
                        this._children.push({ child, params });
                    }
                },
                Button: class {
                    constructor(params) {
                        this.child = params.child;
                        this.style_class = params.style_class;
                        this._handlers = {};
                    }

                    connect(signal, handler) {
                        this._handlers[signal] = handler;
                        return 1;
                    }

                    change_style_pseudo_class() {}
                },
                Bin: class {
                    constructor(params) {
                        Object.assign(this, params || {});
                    }

                    set_child() {}
                },
                IconType: StIconType
            },
            Clutter: {
                ActorAlign: {
                    START: 0,
                    CENTER: 1,
                    END: 2,
                    FILL: 3
                },
                ModifierType: {
                    SHIFT_MASK: 1
                },
                ScrollDirection: {
                    UP: 0,
                    DOWN: 1,
                    SMOOTH: 2
                },
                EVENT_STOP: 1,
                EVENT_PROPAGATE: 0
            },
            Cinnamon: {
                get_event_state(event) {
                    return event && event._shift ?
                        imports.gi.Clutter.ModifierType.SHIFT_MASK :
                        0;
                }
            },
            Pango: {
                EllipsizeMode: {
                    NONE: 0,
                    START: 1,
                    MIDDLE: 2,
                    END: 3
                }
            },
            Cvc: {
                MixerControlState: { READY: 1 },
                MixerSinkInput: MockMixerSinkInput,
                MixerControl: class {
                    constructor() {
                        this._state = 1;
                        this._handlers = {};
                        this._handlerIds = {};
                        this._nextHandlerId = 1;
                        this._outputs = {};
                        this._activeOutput = null;
                        this._inputs = {};
                        this._activeInput = null;
                        this._streams = {};
                    }

                    get_vol_max_norm() {
                        return 65536;
                    }

                    get_state() {
                        return this._state;
                    }

                    open() {
                        this._emit("state-changed");
                    }

                    close() {}

                    connect(signal, handler) {
                        this._handlers[signal] = handler;
                        const id = this._nextHandlerId++;
                        this._handlerIds[id] = signal;
                        return id;
                    }

                    disconnect(id) {
                        const signal = this._handlerIds[id];
                        if (signal) {
                            delete this._handlers[signal];
                            delete this._handlerIds[id];
                        }
                    }

                    lookup_output_id(id) {
                        return this._outputs[id] || null;
                    }

                    change_output(device) {
                        this._activeOutput = device;
                        this._emit("active-output-update");
                    }

                    addOutput(id, device) {
                        this._outputs[id] = device;
                        this._emit("output-added", id);
                    }

                    removeOutput(id) {
                        delete this._outputs[id];
                        this._emit("output-removed", id);
                    }

                    lookup_input_id(id) {
                        return this._inputs[id] || null;
                    }

                    change_input(device) {
                        this._activeInput = device;
                        this._emit("active-input-update");
                    }

                    addInput(id, device) {
                        this._inputs[id] = device;
                        this._emit("input-added", id);
                    }

                    removeInput(id) {
                        delete this._inputs[id];
                        this._emit("input-removed", id);
                    }

                    lookup_stream_id(id) {
                        return this._streams[id] || null;
                    }

                    addStream(id, stream) {
                        this._streams[id] = stream;
                        this._emit("stream-added", id);
                    }

                    removeStream(id) {
                        delete this._streams[id];
                        this._emit("stream-removed", id);
                    }

                    get_default_sink() {
                        if (this._activeOutput)
                            return this._activeOutput;
                        const ids = Object.keys(this._outputs);
                        if (ids.length > 0)
                            return this._outputs[ids[0]];
                        return createMockStream({
                            description: "Built-in Audio",
                            origin: "Analog Stereo"
                        });
                    }

                    get_default_source() {
                        if (this._activeInput)
                            return this._activeInput;
                        const ids = Object.keys(this._inputs);
                        if (ids.length > 0)
                            return this._inputs[ids[0]];
                        return createMockStream({
                            description: "Built-in Microphone",
                            origin: "Analog Mono"
                        });
                    }

                    _emit(signal, ...args) {
                        if (this._handlers[signal])
                            this._handlers[signal](this, ...args);
                    }
                }
            },
            Gio: {
                Settings: class {
                    constructor() {
                        this._allowAmplified = false;
                        this._handlers = {};
                    }
                    connect(signal, handler) {
                        this._handlers[signal] = handler;
                        return 1;
                    }
                    get_boolean(key) {
                        if (key === "allow-amplified-volume")
                            return this._allowAmplified;
                        return false;
                    }
                    setAllowAmplified(value) {
                        this._allowAmplified = value;
                        const handler = this._handlers["changed::allow-amplified-volume"];
                        if (handler)
                            handler();
                    }
                },
                ThemedIcon: {
                    new() {
                        return {};
                    }
                }
            }
        },
        misc: {
            util: {
                spawn() {},
                spawnCommandLine() {}
            }
        }
    };

    globalThis.imports = cinnamonImports;
    if (typeof global !== "undefined")
        global.imports = cinnamonImports;
}

function createMockStream({
    volume = 32768,
    volume_max = 65536,
    is_muted = false,
    description = "",
    origin = ""
} = {}) {
    const handlers = {};
    return {
        volume,
        volume_max,
        is_muted,
        description,
        origin,
        get_icon_name() {
            return "audio-card-symbolic";
        },
        connect(signal, handler) {
            handlers[signal] = handler;
            return Object.keys(handlers).length;
        },
        disconnect() {},
        push_volume() {},
        change_is_muted(muted) {
            this.is_muted = muted;
            if (handlers["notify::is-muted"])
                handlers["notify::is-muted"]();
        }
    };
}

function createMockOutput(id, description, origin, iconName) {
    return {
        index: id,
        description,
        origin,
        get_icon_name() {
            return iconName || "audio-card-symbolic";
        }
    };
}

function createMockInput(id, description, origin, iconName) {
    return createMockOutput(id, description, origin, iconName || "audio-input-microphone-symbolic");
}

function createMockAppStream({
    name = "Firefox",
    icon_name = "firefox",
    volume = 32768,
    volume_max = 65536,
    is_muted = false,
    application_id = "firefox",
    is_virtual = false
} = {}) {
    const stream = createMockStream({ volume, volume_max, is_muted });
    Object.assign(stream, {
        name,
        icon_name,
        application_id,
        is_virtual
    });
    Object.setPrototypeOf(stream, MockMixerSinkInput.prototype);
    return stream;
}

module.exports = {
    setupCinnamonMocks,
    createMockStream,
    createMockOutput,
    createMockInput,
    createMockAppStream,
    createActor
};
