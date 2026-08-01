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
        width: 100,
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
        connect() {
            return 1;
        },
        disconnect() {},
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

    connect(signal, handler) {
        this._handlers[signal] = handler;
        return 1;
    }
}

class IconApplet {
    constructor(orientation, panelHeight, instanceId) {
        this._init(orientation, panelHeight, instanceId);
    }

    _init() {
        this.actor = createActor("IconApplet");
    }

    set_applet_icon_symbolic_name() {}
    set_applet_tooltip() {}
}

class AppletPopupMenu {
    constructor(applet, orientation) {
        this.actor = createActor("AppletPopupMenu");
        this.box = createActor("menu-box");
        this._items = [];
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
        if (!(key in this.target))
            this.target[prop] = null;
        if (callback)
            callback();
    }
}

function setupCinnamonMocks() {
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
                    play() {}
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
                        this.clutterText = { ellipsize: 0 };
                        this.actor = createActor("label");
                    }
                },
                BoxLayout: class {
                    constructor(params) {
                        Object.assign(this, params || {});
                        this._children = [];
                    }

                    add_actor(child) {
                        this._children.push(child);
                    }

                    add(child, params) {
                        this._children.push({ child, params });
                    }
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
                ScrollDirection: {
                    UP: 0,
                    DOWN: 1,
                    SMOOTH: 2
                },
                EVENT_STOP: 1,
                EVENT_PROPAGATE: 0
            },
            Cvc: {
                MixerControlState: { READY: 1 },
                MixerControl: class {
                    constructor() {
                        this._state = 1;
                        this._handlers = {};
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
                        return 1;
                    }

                    get_default_sink() {
                        return createMockStream();
                    }

                    get_default_source() {
                        return createMockStream({ is_muted: false });
                    }

                    _emit(signal) {
                        if (this._handlers[signal])
                            this._handlers[signal]();
                    }
                }
            },
            Gio: {
                Settings: class {
                    constructor() {}
                    connect() {
                        return 1;
                    }
                    get_boolean() {
                        return false;
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
    is_muted = false
} = {}) {
    const handlers = {};
    return {
        volume,
        volume_max,
        is_muted,
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

module.exports = { setupCinnamonMocks, createMockStream, createActor };
