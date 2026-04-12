// first rule dont ask
function dontAsk(layer = 3) {
    if (layer === 0) {
        return layer
    }

    return { left: dontAsk(layer - 1), middle: dontAsk(layer - 1), right: dontAsk(layer - 1) }
}


console.log(JSON.stringify(dontAsk(), null, 3));