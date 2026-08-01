function deviceDisplayIcon(device) {
    if (device.get_icon_name) {
        const name = device.get_icon_name();
        if (name)
            return name;
    }
    return "audio-card-symbolic";
}

module.exports = { deviceDisplayIcon };
