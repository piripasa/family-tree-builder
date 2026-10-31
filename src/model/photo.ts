const MAX_EDGE = 480;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export function readProfilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Choose an image file."));
  }
  if (file.size > MAX_FILE_BYTES) {
    return Promise.reject(new Error("That image is too large."));
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("That image could not be read."));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      const data = canvas.toDataURL("image/jpeg", 0.82);
      URL.revokeObjectURL(url);
      resolve(data);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be read."));
    };
    image.src = url;
  });
}
