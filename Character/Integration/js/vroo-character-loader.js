export class VrooCharacterLoader {
  constructor({ baseUrl = "./Character" } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.manifest = null;
  }

  async loadManifest() {
    const url = `${this.baseUrl}/Data/vehicle-character-manifest.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Character manifest load failed: ${response.status}`);
    this.manifest = await response.json();
    return this.manifest;
  }

  getVehicle(vehicleId) {
    if (!this.manifest) throw new Error("Call loadManifest() first.");
    return this.manifest.vehicles.find(v => v.id === vehicleId)
      || this.manifest.vehicles.find(v => v.id === this.manifest.defaultVehicleId);
  }

  resolveAsset(relativePath) {
    return `${this.baseUrl}/${relativePath}`.replace(/\\/g, "/");
  }

  renderInto(target, vehicleId, view = "front45") {
    const element = typeof target === "string" ? document.querySelector(target) : target;
    if (!element) throw new Error("Character target element not found.");

    const vehicle = this.getVehicle(vehicleId);
    const asset = vehicle.views[view] || vehicle.views.front45;

    element.innerHTML = "";
    const img = document.createElement("img");
    img.className = "vroo-character-image";
    img.src = this.resolveAsset(asset);
    img.alt = `${vehicle.name} ${view}`;
    img.draggable = false;
    element.appendChild(img);
    element.dataset.vehicleId = vehicle.id;
    return { vehicle, img };
  }
}
