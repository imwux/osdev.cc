const DECODER_STORAGE_KEY = "osdev.selectedDecoder";

let selectedDecoder = -1;
let decoders = [];

const queryDecoderParam = new URLSearchParams(window.location.search).get("decoder");

const normalizeDecoderKey = (value) => {
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase();
};

const findDecoderIndexByKey = (value) => {
    const normalized = normalizeDecoderKey(value);
    if (!normalized) return -1;
    return decoders.findIndex((decoder) => {
        if (!decoder) return false;
        return normalizeDecoderKey(decoder.id) === normalized;
    });
};

const persistSelectedDecoder = () => {
    if (selectedDecoder < 0 || !decoders[selectedDecoder]) {
        localStorage.removeItem(DECODER_STORAGE_KEY);
        return;
    }
    localStorage.setItem(DECODER_STORAGE_KEY, decoders[selectedDecoder].id);
};

const decoderMain = document.getElementById("decoder");
const decoderTable = document.createElement("table");
const decoderControls = document.createElement("div");
decoderControls.classList.add("decoder-selector");

const decoderSelectorLabel = document.createElement("label");
decoderSelectorLabel.setAttribute("for", "decoder-selector");
const decoderSelector = document.createElement("select");
decoderSelector.id = "decoder-selector";
decoderSelector.addEventListener("change", (event) => {
    const index = Number(event.target.value);
    if (Number.isNaN(index)) return;
    selectedDecoder = index;
    persistSelectedDecoder();
    updateDecoder();
});

decoderControls.appendChild(decoderSelectorLabel);
decoderControls.appendChild(decoderSelector);
decoderMain.appendChild(decoderControls);
decoderMain.appendChild(decoderTable);

/* Update */
const updateDecoder = () => {
    decoderTable.innerHTML = "";
    if (selectedDecoder < 0) {
        decoderSelector.selectedIndex = -1;
        return;
    }

    decoderSelector.value = selectedDecoder.toString();

    const thead = decoderTable.createTHead();
    const tr = thead.insertRow();
    const thField = tr.insertCell();
    const thBits = tr.insertCell();
    const thValue = tr.insertCell();
    thField.textContent = "Field";
    thBits.textContent = "Bits";
    thValue.textContent = "Value";

    const tbody = decoderTable.createTBody();

    const makeMask = (length) => {
        let mask = 0n;
        for (let i = 0; i < length; i++) mask += 1n << BigInt(i);
        return mask;
    };

    const processRows = (dataRows, pos) => {
        for (const dataRow of dataRows) {
            if (dataRow.position !== undefined) {
                if (pos.i > dataRow.position) {
                    console.error("decoder malformed");
                    continue;
                }
                pos.i = dataRow.position;
            }

            const startBit = pos.i;
            const value = (currentValue >> BigInt(startBit)) & makeMask(dataRow.length);
            pos.i += dataRow.length;

            const row = tbody.insertRow();
            row.setAttribute("title", `bit: ${startBit}, length: ${dataRow.length}`);
            if (value > 0) row.classList.add("active");

            const labelCell = row.insertCell();
            labelCell.innerText = dataRow.label;
            if (dataRow.note) {
                const noteIcon = document.createElement("span");
                noteIcon.classList.add("decoder-note");
                noteIcon.setAttribute("title", dataRow.note);
                noteIcon.textContent = "?";
                labelCell.appendChild(noteIcon);
            }

            const bitCell = row.insertCell();
            const endBit = startBit + dataRow.length - 1;
            bitCell.classList.add("bits");
            bitCell.innerText = dataRow.length === 1 ? `${startBit}` : `${startBit}..${endBit}`;

            const valueCell = row.insertCell();
            valueCell.classList.add("value");

            const as = dataRow.as ?? "decimal";
            let valueString;
            switch (as) {
                case "hex":
                    valueString = `0x${value.toString(16)}`;
                    break;
                case "decimal":
                    valueString = value.toString(10);
                    break;
                case "boolean":
                    valueString = value === 0n ? "false" : "true";
                    break;
                default:
                    break;
            }

            valueCell.innerText = dataRow.match !== undefined ? `${dataRow.match[value]}` : valueString;

            if (dataRow.branch) {
                const branchData = dataRow.branch[value.toString()];
                if (branchData) processRows(branchData, pos);
            }
        }
    };

    processRows(decoders[selectedDecoder].data, { i: 0 });
};

/* Share */
const shareBtn = document.getElementById("share-btn");
const shareIcon = document.getElementById("share-icon");
const shareIconCheck = document.getElementById("share-icon-check");

shareBtn.addEventListener("click", () => {
    const params = new URLSearchParams();
    params.set("value", "0x" + currentValue.toString(16));
    if (selectedDecoder >= 0 && decoders[selectedDecoder]) {
        params.set("decoder", decoders[selectedDecoder].id);
    }
    const url = `${location.origin}${location.pathname}?${params}`;
    navigator.clipboard.writeText(url).then(() => {
        shareIcon.style.display = "none";
        shareIconCheck.style.display = "";
        setTimeout(() => {
            shareIcon.style.display = "";
            shareIconCheck.style.display = "none";
        }, 1500);
    });
});

/* Decoder */
updateDecoder();

fetch("/decoder-entries.json")
    .then((res) => res.json())
    .then((data) => {
        decoders = data.sort((a, b) => a.name > b.name);

        decoderSelector.innerHTML = "";
        for (let i = 0; i < decoders.length; i++) {
            const option = document.createElement("option");
            option.value = i.toString();
            option.textContent = decoders[i].name;
            decoderSelector.appendChild(option);
        }

        if (decoders.length > 0) {
            const storedKey = localStorage.getItem(DECODER_STORAGE_KEY);
            const storedIndex = findDecoderIndexByKey(storedKey);
            selectedDecoder = storedIndex >= 0 ? storedIndex : 0;

            const queryIndex = findDecoderIndexByKey(queryDecoderParam);
            if (queryIndex >= 0) {
                selectedDecoder = queryIndex;
            }

            decoderSelector.disabled = false;
        } else {
            selectedDecoder = -1;
            decoderSelector.disabled = true;
            localStorage.removeItem(DECODER_STORAGE_KEY);
        }
        updateDecoder();
        persistSelectedDecoder();
    });
