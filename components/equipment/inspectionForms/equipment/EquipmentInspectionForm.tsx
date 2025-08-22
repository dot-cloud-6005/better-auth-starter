import { BaseInspectionForm } from '../BaseInspectionForm';
import { EquipmentFormProps } from '../types';

export const EquipmentInspectionForm = ({ selectedItem }: EquipmentFormProps) => {
  return (
    <BaseInspectionForm title="Equipment Inspection Fields" icon="🔧">
      
      {/* ─── Equipment Information ─────────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 border-b dark:border-slate-700 pb-2">
          Equipment Information
        </h4>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">Equipment Name:</span>
              <span className="ml-2 text-slate-600 dark:text-slate-400">{selectedItem.name}</span>
            </div>
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">Auto ID:</span>
              <span className="ml-2 text-slate-600 dark:text-slate-400">{selectedItem.autoId}</span>
            </div>
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">Group:</span>
              <span className="ml-2 text-slate-600 dark:text-slate-400">{selectedItem.group}</span>
            </div>
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">Location:</span>
              <span className="ml-2 text-slate-600 dark:text-slate-400">{selectedItem.location || 'Not specified'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Inspection Notes ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 border-b dark:border-slate-700 pb-2">
          Inspection Details
        </h4>

        {/* <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Inspection Notes
          </label>
          <textarea
            name="notes"
            rows={6}
            className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Enter detailed inspection notes, observations, condition assessment, recommendations, etc..."
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Include any relevant observations about the equipment condition, functionality, safety concerns, or maintenance recommendations.
          </p>
        </div> */}
      </div>
    </BaseInspectionForm>
  );
};