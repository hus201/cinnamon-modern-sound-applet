function volumeIconName(ratio, muted) {
    if (muted || ratio < 0.005)
        return "xsi-audio-volume-muted";
    if (ratio < 0.33)
        return "xsi-audio-volume-low";
    if (ratio < 0.66)
        return "xsi-audio-volume-medium";
    return "xsi-audio-volume-high";
}

module.exports = { volumeIconName };
