const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;

const VOLUME_ADJUSTMENT_STEP = 0.05;

function adjustMasterVolume(applet, deltaSteps) {
    const output = applet._output;
    if (!output || !deltaSteps)
        return false;

    const norm = applet._volumeNorm || 1;
    const max = output.volume_max || norm;
    const step = norm * VOLUME_ADJUSTMENT_STEP;
    const currentVolume = output.volume;

    if (deltaSteps < 0) {
        const prevMuted = output.is_muted;
        output.volume = Math.max(0, currentVolume + deltaSteps * step);
        if (output.volume < 1) {
            output.volume = 0;
            if (!prevMuted)
                output.change_is_muted(true);
        } else if (
            output.volume !== norm &&
            output.volume > norm * (1 - VOLUME_ADJUSTMENT_STEP / 2) &&
            output.volume < norm * (1 + VOLUME_ADJUSTMENT_STEP / 2)
        ) {
            output.volume = norm;
        }
    } else {
        output.volume = Math.min(max, currentVolume + deltaSteps * step);
        if (
            output.volume !== norm &&
            output.volume > norm * (1 - VOLUME_ADJUSTMENT_STEP / 2) &&
            output.volume < norm * (1 + VOLUME_ADJUSTMENT_STEP / 2)
        ) {
            output.volume = norm;
        }
        output.change_is_muted(false);
    }

    output.push_volume();
    if (Main.soundManager)
        Main.soundManager.play("volume");
    if (applet._updatePanelIcon)
        applet._updatePanelIcon();
    return true;
}

function onIconScrollEvent(applet, _actor, event) {
    const direction = event.get_scroll_direction();

    if (direction === Clutter.ScrollDirection.SMOOTH)
        return Clutter.EVENT_PROPAGATE;

    if (direction === Clutter.ScrollDirection.UP)
        adjustMasterVolume(applet, 1);
    else if (direction === Clutter.ScrollDirection.DOWN)
        adjustMasterVolume(applet, -1);

    return Clutter.EVENT_STOP;
}

function connectIconScrollHandler(applet) {
    applet.actor.connect("scroll-event", (...args) => onIconScrollEvent(applet, ...args));
}

module.exports = {
    VOLUME_ADJUSTMENT_STEP,
    adjustMasterVolume,
    onIconScrollEvent,
    connectIconScrollHandler
};
