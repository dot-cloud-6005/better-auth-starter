import { PetrolPlantInspectionForm } from './plant/PetrolPlantInspectionForm';
import { VehicleInspectionForm } from './plant/VehicleInspectionForm';
import { TruckInspectionForm } from './plant/TruckInspectionForm';
import { TrailerInspectionForm } from './plant/TrailerInspectionForm';
import { VesselInspectionForm } from './plant/VesselInspectionForm';
import { PlantInspectable } from './types';

interface PlantInspectionFormSelectorProps {
  selectedItem: PlantInspectable;
}

export const PlantInspectionFormSelector = ({ selectedItem }: PlantInspectionFormSelectorProps) => {
  const plantGroup = selectedItem.group.toLowerCase();

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🚛 TRUCK PLANT TYPE - TODO: Implement (separate from vehicles)
  // ═══════════════════════════════════════════════════════════════════════════════
  if (plantGroup.includes('truck')) {
    return <TruckInspectionForm selectedItem={selectedItem} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🚗 VEHICLE PLANT TYPE 
  // ═══════════════════════════════════════════════════════════════════════════════
  if (plantGroup.includes('vehicle') || plantGroup.includes('car') || plantGroup.includes('ute') || plantGroup.includes('van')) {
    return <VehicleInspectionForm selectedItem={selectedItem} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ⛽ PETROL PLANT TYPE 
  // ═══════════════════════════════════════════════════════════════════════════════
  if (plantGroup.includes('petrol') || plantGroup.includes('generator') || plantGroup.includes('pump')) {
    return <PetrolPlantInspectionForm selectedItem={selectedItem} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🚛 TRAILER PLANT TYPE 
  // ═══════════════════════════════════════════════════════════════════════════════
  if (plantGroup.includes('trailer')) {
    return <TrailerInspectionForm selectedItem={selectedItem} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ⛵ VESSEL PLANT TYPE - TODO: Implement
  // ═══════════════════════════════════════════════════════════════════════════════
  if (plantGroup.includes('vessel') || plantGroup.includes('boat') || plantGroup.includes('marine') || plantGroup.includes('ship')) {
    return <VesselInspectionForm selectedItem={selectedItem} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🏗️ CONSTRUCTION PLANT TYPE - TODO: Implement
  // ═══════════════════════════════════════════════════════════════════════════════
  if (plantGroup.includes('construction') || plantGroup.includes('excavator') || plantGroup.includes('bulldozer') || plantGroup.includes('crane')) {
    return (
      <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center">
          🏗️ Construction Plant Inspection Fields
        </h3>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>TODO:</strong> Construction plant inspection form needs to be implemented.
            <br />
            Coming soon...
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔌 ELECTRICAL PLANT TYPE - TODO: Implement
  // ═══════════════════════════════════════════════════════════════════════════════
  if (plantGroup.includes('electrical') || plantGroup.includes('transformer') || plantGroup.includes('switchgear')) {
    return (
      <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center">
          🔌 Electrical Plant Inspection Fields
        </h3>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>TODO:</strong> Electrical plant inspection form needs to be implemented.
            <br />
            Coming soon...
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🏭 INDUSTRIAL PLANT TYPE - TODO: Implement
  // ═══════════════════════════════════════════════════════════════════════════════
  if (plantGroup.includes('industrial') || plantGroup.includes('compressor')) {
    return (
      <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center">
          🏭 Industrial Plant Inspection Fields
        </h3>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>TODO:</strong> Industrial plant inspection form needs to be implemented.
            <br />
            Coming soon...
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔧 DEFAULT/UNKNOWN PLANT TYPE
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center">
        🔧 General Plant Inspection
      </h3>
      <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md p-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          No specific inspection fields defined for this plant type: <strong>{selectedItem.group}</strong>
          <br />
          Use the general notes section below to record inspection details.
        </p>
      </div>
    </div>
  );
};