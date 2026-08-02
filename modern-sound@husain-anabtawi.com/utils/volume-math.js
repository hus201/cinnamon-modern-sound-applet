const VOLUME_ADJUSTMENT_STEP = 0.05;
const MUTE_THRESHOLD = 0.005;

function volumeNorm(norm) {
    return norm || 1;
}

function streamMax(stream, norm) {
    return stream.volume_max || volumeNorm(norm);
}

function displayVolume(stream) {
    if (!stream || stream.is_muted)
        return 0;
    return stream.volume;
}

function volumePercent(volume, norm) {
    return Math.round((volume / volumeNorm(norm)) * 100) || 0;
}

function formatVolumePercent(volume, norm) {
    return `${volumePercent(volume, norm)}%`;
}

function readStreamVolume(stream, norm) {
    const volume = displayVolume(stream);
    const max = streamMax(stream, norm);
    return {
        ratio: Math.min(1, volume / max),
        percent: volumePercent(volume, norm),
        muted: stream.is_muted
    };
}

function applySliderRatio(ratio, stream, norm) {
    const max = streamMax(stream, norm);
    const volume = ratio * max;
    return {
        volume,
        muted: ratio < MUTE_THRESHOLD,
        percent: volumePercent(volume, norm)
    };
}

function panelVolumeRatio(stream, norm) {
    return displayVolume(stream) / streamMax(stream, norm);
}

function snapVolumeToNorm(volume, norm, adjustmentStep) {
    const step = adjustmentStep || VOLUME_ADJUSTMENT_STEP;
    const target = volumeNorm(norm);
    if (
        volume !== target &&
        volume > target * (1 - step / 2) &&
        volume < target * (1 + step / 2)
    ) {
        return target;
    }
    return volume;
}

function adjustStreamVolume(stream, norm, deltaSteps) {
    if (!stream || !deltaSteps)
        return false;

    const targetNorm = volumeNorm(norm);
    const max = streamMax(stream, norm);
    const step = targetNorm * VOLUME_ADJUSTMENT_STEP;
    const currentVolume = stream.volume;

    if (deltaSteps < 0) {
        const prevMuted = stream.is_muted;
        stream.volume = Math.max(0, currentVolume + deltaSteps * step);
        if (stream.volume < 1) {
            stream.volume = 0;
            if (!prevMuted)
                stream.change_is_muted(true);
        } else {
            stream.volume = snapVolumeToNorm(stream.volume, norm, VOLUME_ADJUSTMENT_STEP);
        }
    } else {
        stream.volume = Math.min(max, currentVolume + deltaSteps * step);
        stream.volume = snapVolumeToNorm(stream.volume, norm, VOLUME_ADJUSTMENT_STEP);
        stream.change_is_muted(false);
    }

    stream.push_volume();
    return true;
}

module.exports = {
    VOLUME_ADJUSTMENT_STEP,
    MUTE_THRESHOLD,
    volumeNorm,
    streamMax,
    displayVolume,
    volumePercent,
    formatVolumePercent,
    readStreamVolume,
    applySliderRatio,
    panelVolumeRatio,
    adjustStreamVolume
};
