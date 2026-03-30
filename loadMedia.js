// Virtual filesnames are being stored here
const names = []
window.images = {}
window.videos = {}
const fileInput = document.getElementById('fileInput');

const form = document.getElementById('uploadForm');
if (form) {
    form.addEventListener('submit', handleSubmit);
}

if (fileInput) {
    fileInput.addEventListener('change', handleSubmit);
}

function handleSubmit(event) {
    if (event.type === 'submit') {
        event.preventDefault();
    }

    const file = fileInput.files[0];
    if (!file) return;

    const name = file.name
    const reader = new FileReader();

    if (file) {
        if (name.slice(-3) === "wav" || name.slice(-3) === "WAV" || name.slice(-4) === "aiff") {
            reader.readAsArrayBuffer(file);
        }
        if (name.slice(-3) === "jpg" || name.slice(-3) === "png" || name.slice(-3) === "webm" || name.slice(-3) === "mp4" || name.slice(-4) === "jpeg") {
            reader.readAsDataURL(file)
        }
        reader.onload = (fileReaderEvent) => {

            var counter = 0
            for (var i = 0; i < names.length; i++) {
                if (name !== names[i]) {
                    counter++;
                }
            }
            if (counter === names.length) {
                var nameTemp = name.slice(0, name.length - 4)
                if (name.slice(-3) === "wav" || name.slice(-3) === "WAV" || name.slice(-4) === "aiff") {
                    if (typeof theChuck !== 'undefined') {
                        theChuck.createFile("", nameTemp + ".wav", new Uint8Array(fileReaderEvent.target.result))
                    }
                    names.push(name)
                }
                if (name.slice(-3) === "jpg" || name.slice(-3) === "png" || name.slice(-3) === "webm") {
                    objectName = name;
                    window.images[objectName] = fileReaderEvent.target.result
                    names.push('images["' + name + '"]')
                    if (typeof loadMediaToHydra === 'function') {
                        loadMediaToHydra('image', fileReaderEvent.target.result, name);
                    }
                }
                if (name.slice(-3) === "mp4") {
                    objectName = name;
                    window.videos[objectName] = fileReaderEvent.target.result
                    names.push('videos["' + name + '"]')
                    if (typeof loadMediaToHydra === 'function') {
                        loadMediaToHydra('video', fileReaderEvent.target.result, name);
                    }
                }
                console.log("file: " + nameTemp + " created in the virtual system")
                names.push(name)
                const node = document.createElement("li");
                const textnode = document.createTextNode(names[i]);
                node.appendChild(textnode);
                ulHolder.appendChild(node);
                fileInput.value = ""
            } else {
                fileInput.value = ""
            }
        }
    }
}

const ulHolder = document.getElementById('fileList')