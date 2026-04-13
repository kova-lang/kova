// first rule dont ask
function dontAsk(layer = 3) {
    if (layer === 0) {
        return layer
    }

    return { left: dontAsk(layer - 1), middle: dontAsk(layer - 1), right: dontAsk(layer - 1) }
}


console.log(JSON.stringify(dontAsk(), null, 3));


let count = 4;

function oneSideNest(count = 4) {
    let side1 = { fruit: "Grape", dairy: "cheese", pastry: "bread" };
    let side2 = { fruit: "Banana", dairy: "milk", pastry: "cake" };
    while (count > 0) {
    
        console.log(count)
        side1 = { side1, side2 }
        count--;
    }
    return side1;
}

console.log(JSON.stringify(oneSideNest(), null, 2));