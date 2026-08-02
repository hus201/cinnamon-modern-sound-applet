const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;

const { applyDeviceIcon, INPUT_DEVICE_FALLBACK_ICON } = require("./utils/device-icon-resolver");

const HEADER_LABEL_MAX = 210;

function ellipsizeHeaderLabel(label) {
    if (!label)
        return;

    if (label.clutter_text)
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;

    label.set_style(`max-width: ${HEADER_LABEL_MAX}px;`);
}

class InputDeviceItem extends PopupMenu.PopupBaseMenuItem {
    constructor(applet) {
        super({ activate: false, hover: false });
        this._applet = applet;
        this._expanded = false;
        this._devices = [];
        this.actor.add_style_class_name("modern-sound-input-item");

        this._deviceIcon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: INPUT_DEVICE_FALLBACK_ICON,
            icon_size: 18,
            style_class: "modern-sound-input-header-icon"
        });

        this._nameLabel = new St.Label({
            text: _("No input device"),
            style_class: "modern-sound-input-name",
            y_align: Clutter.ActorAlign.CENTER
        });
        ellipsizeHeaderLabel(this._nameLabel);

        this._subtitleLabel = new St.Label({
            text: "",
            style_class: "modern-sound-input-subtitle",
            y_align: Clutter.ActorAlign.CENTER
        });
        ellipsizeHeaderLabel(this._subtitleLabel);

        this._labels = new St.BoxLayout({
            vertical: true,
            style_class: "modern-sound-input-labels",
            x_expand: true
        });
        this._labels.add_actor(this._nameLabel);
        this._labels.add_actor(this._subtitleLabel);

        this._chevron = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: "pan-down-symbolic",
            icon_size: 14,
            style_class: "modern-sound-input-chevron",
            y_align: Clutter.ActorAlign.CENTER
        });

        this._header = new St.BoxLayout({
            style_class: "modern-sound-input-header",
            reactive: true,
            track_hover: true,
            can_focus: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this._header.add_actor(this._deviceIcon);
        this._header.add(this._labels, { expand: true, x_fill: true, y_fill: false });
        this._header.add_actor(this._chevron);

        this._header.connect("button-release-event", (_actor, event) => {
            if (event.get_button() !== 1 || this._devices.length <= 1)
                return Clutter.EVENT_PROPAGATE;
            this._toggleExpanded();
            return Clutter.EVENT_STOP;
        });

        this._listBox = new St.BoxLayout({
            vertical: true,
            style_class: "modern-sound-input-list",
            visible: false
        });

        this._outer = new St.BoxLayout({
            vertical: true,
            style_class: "modern-sound-input-wrap",
            x_expand: true
        });
        this._outer.add_actor(this._header);
        this._outer.add_actor(this._listBox);

        this.addActor(this._outer, { span: -1, expand: true });
    }

    bindControl(control) {
        if (this._control) {
            this._control.disconnect(this._inputAddedId);
            this._control.disconnect(this._inputRemovedId);
            this._control.disconnect(this._activeInputId);
        }

        this._control = control;
        if (!control)
            return;

        this._inputAddedId = control.connect("input-added", (_c, id) => {
            this._addDevice(id);
        });
        this._inputRemovedId = control.connect("input-removed", (_c, id) => {
            this._removeDevice(id);
        });
        this._activeInputId = control.connect("active-input-update", () => {
            this._syncActiveDevice();
        });
    }

    _toggleExpanded() {
        this._expanded = !this._expanded;
        this._listBox.visible = this._expanded;
        this._chevron.icon_name = this._expanded ?
            "pan-up-symbolic" :
            "pan-down-symbolic";
        this.actor.change_style_pseudo_class("open", this._expanded);
    }

    _addDevice(id) {
        if (!this._control || this._devices.some((entry) => entry.id === id))
            return;

        const device = this._control.lookup_input_id(id);
        if (!device)
            return;

        const row = this._createDeviceRow(device);
        this._devices.push({ id, device, row });
        this._listBox.add_actor(row);

        this._updateExpandableState();
        this._syncActiveDevice();
    }

    _removeDevice(id) {
        const index = this._devices.findIndex((entry) => entry.id === id);
        if (index === -1)
            return;

        const [entry] = this._devices.splice(index, 1);
        this._listBox.remove_actor(entry.row);
        entry.row.destroy();

        this._updateExpandableState();
        this._syncActiveDevice();
    }

    _createDeviceRow(device) {
        const radio = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: "radio-off-symbolic",
            icon_size: 14,
            style_class: "modern-sound-input-radio"
        });

        const icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: INPUT_DEVICE_FALLBACK_ICON,
            icon_size: 16,
            style_class: "modern-sound-input-row-icon"
        });
        applyDeviceIcon(icon, device);

        const name = new St.Label({
            text: device.description || _("Unknown device"),
            style_class: "modern-sound-input-row-name"
        });

        const subtitle = new St.Label({
            text: device.origin || "",
            style_class: "modern-sound-input-row-subtitle"
        });

        const labels = new St.BoxLayout({ vertical: true, x_expand: true });
        labels.add_actor(name);
        if (device.origin)
            labels.add_actor(subtitle);

        const check = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: "emblem-ok-symbolic",
            icon_size: 14,
            style_class: "modern-sound-input-check",
            opacity: 0
        });

        const row = new St.BoxLayout({
            style_class: "modern-sound-input-row",
            reactive: true,
            track_hover: true,
            can_focus: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        row.add_actor(radio);
        row.add_actor(icon);
        row.add(labels, { expand: true, x_fill: true, y_fill: false });
        row.add_actor(check);

        row._device = device;
        row._radio = radio;
        row._check = check;

        row.connect("button-press-event", (_actor, event) => {
            if (event.get_button() !== 1 || !this._control)
                return Clutter.EVENT_PROPAGATE;
            this._control.change_input(device);
            return Clutter.EVENT_STOP;
        });

        return row;
    }

    _updateExpandableState() {
        const hasMultiple = this._devices.length > 1;
        this._chevron.visible = hasMultiple;
        this._header.reactive = hasMultiple;
        this._header.track_hover = hasMultiple;

        if (!hasMultiple && this._expanded) {
            this._expanded = false;
            this._listBox.visible = false;
            this._chevron.icon_name = "pan-down-symbolic";
            this.actor.change_style_pseudo_class("open", false);
        }
    }

    _syncActiveDevice() {
        const active = this._applet._input;
        const activeId = active ? active.index : null;

        if (active) {
            this._nameLabel.text = active.description || _("Unknown device");
            this._subtitleLabel.text = _("Input device");
            this._subtitleLabel.visible = true;
            applyDeviceIcon(this._deviceIcon, active);
        } else {
            this._nameLabel.text = _("No input device");
            this._subtitleLabel.text = "";
            this._subtitleLabel.visible = false;
            applyDeviceIcon(this._deviceIcon, null, INPUT_DEVICE_FALLBACK_ICON);
        }

        for (const entry of this._devices) {
            const isActive = activeId !== null && entry.id === activeId;
            entry.row._radio.icon_name = isActive ?
                "radio-checked-symbolic" :
                "radio-off-symbolic";
            entry.row._check.opacity = isActive ? 255 : 0;
            entry.row.change_style_pseudo_class("active", isActive);
        }
    }
}

module.exports = { InputDeviceItem };
