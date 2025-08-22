import { BaseInspectionForm } from '../BaseInspectionForm';
import { PlantFormProps } from '../types';

export const PetrolPlantInspectionForm = ({ selectedItem }: PlantFormProps) => {
  return (

    

    
    <BaseInspectionForm title="Petrol Plant Inspection Fields" icon="⛽">

      
      {/* ─── Plant Information ─────────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">
          Plant Information
        </h4>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-slate-700">Plant Name:</span>
              <span className="ml-2 text-slate-600">{selectedItem.name}</span>
            </div>
            <div>
              <span className="font-medium text-slate-700">Auto ID:</span>
              <span className="ml-2 text-slate-600">{selectedItem.autoId}</span>
            </div>
            <div>
              <span className="font-medium text-slate-700">Group:</span>
              <span className="ml-2 text-slate-600">{selectedItem.group}</span>
            </div>
          </div>
        </div>
      </div>
      
    
      {/* ─── Status of Plant ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <span className="block text-sm font-medium text-slate-700 mb-2">
          Status of Plant
        </span>

        <div className="flex flex-wrap gap-4 text-sm">
          {[
            { label: 'Unable to locate', value: 'unable_to_locate' },
            { label: 'Decommissioned', value: 'decommissioned' },
            { label: 'Out of Service', value: 'out_of_service' },
            { label: 'Located & Serviceable', value: 'located_serviceable' },
          ].map((opt) => (
            <label key={opt.value} className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="plantStatus"
                value={opt.value}
                className="text-blue-600 focus:ring-blue-500"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>


      {/* ─── Inspection checklist (radio buttons styled as check-boxes) ──── */}
      <div className="border-t pt-4 mt-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">
          Inspection Checklist
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: 'fixings', label: 'Fixings' },
            { name: 'guards', label: 'Guards' },
            { name: 'oilLeaks', label: 'Oil Leaks' },
            { name: 'fuelLeaks', label: 'Fuel Leaks' },
            { name: 'batteryCondition', label: 'Battery Condition' },
            { name: 'fluidLevels', label: 'Fluid Levels' },
            { name: 'equipmentOperational', label: 'Equipment Operational' },
          ].map((item) => (
            <div key={item.name}>
              <span className="block text-sm font-medium text-slate-700 mb-1">
                {item.label}
              </span>

              {/* Confirmed / Not Confirmed – single-choice radio group */}
              {['confirmed', 'not_confirmed'].map((state) => (
                <label
                  key={state}
                  className="inline-flex items-center gap-1.5 mr-4"
                >
                  <input
                    type="radio"
                    name={item.name}
                    value={state}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  {state === 'confirmed' ? 'Confirmed' : 'Not Confirmed'}
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Additional comments ────────────────────────────────────────── */}
      {/* <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Additional Comments
        </label>
        <textarea
          name="additionalComments"
          rows={4}
          className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="Anything else worth noting…"
        />
      </div> */}
    </BaseInspectionForm>
  );
};