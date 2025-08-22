'use client';

import { useState } from 'react';
import { BaseInspectionForm } from '../BaseInspectionForm';
import { PlantFormProps } from '../types';
import { getDueStatus } from '@/lib/equipment/dueStatus';

function formatDate(value?: Date | string) {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export const VehicleInspectionForm = ({ selectedItem }: PlantFormProps) => {
  const [isActionRequired, setIsActionRequired] = useState(false);
  const due = getDueStatus(selectedItem?.serviceDueDate);

  return (
    <BaseInspectionForm title="Vehicle Inspection Fields" icon="🚗">
      {/* ─── Vehicle Information ─────────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">Vehicle Information</h4>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-slate-700">Vehicle Name:</span>
              <span className="ml-2 text-slate-600">{selectedItem?.name || '-'}</span>
            </div>
            <div>
              <span className="font-medium text-slate-700">Auto ID:</span>
              <span className="ml-2 text-slate-600">{selectedItem?.autoId || '-'}</span>
            </div>
            {selectedItem?.vehicleMake && (
              <div>
                <span className="font-medium text-slate-700">Make:</span>
                <span className="ml-2 text-slate-600">{selectedItem.vehicleMake}</span>
              </div>
            )}
            {selectedItem?.vehicleModel && (
              <div>
                <span className="font-medium text-slate-700">Model:</span>
                <span className="ml-2 text-slate-600">{selectedItem.vehicleModel}</span>
              </div>
            )}
            <div>
              <span className="font-medium text-slate-700">Registration Number:</span>
              <span className="ml-2 text-slate-600">{selectedItem?.registrationNumber || 'Not specified'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Vehicle Service Information ─────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">📅 Service Information</h4>

        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Service Due Date</label>
              <input
                type="date"
                name="CurrentServiceDueDate"
                defaultValue={formatDate(selectedItem?.serviceDueDate)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <div className="mt-2">
                <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${due.className}`}>
                  {due.label}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Service Due (km)</label>
              <input
                type="number"
                name="CurrentServiceDueKm"
                defaultValue={selectedItem?.serviceDueOdometer}
                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Current service due km"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Vehicle Condition Checks ─────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">Vehicle Condition Checks</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: 'TyresServicable', label: 'Tyres Serviceable?' },
            { name: 'CorrectTyrePressure', label: 'Correct Tyre Pressure?' },
            { name: 'WindscreenCleanNOTChipped2', label: 'Windscreen Clean (NOT Chipped)?' },
            { name: 'LicencedCorrectly', label: 'Licensed Correctly?' },
            { name: 'VehicleServicesAsRequired', label: 'Vehicle Services as Required?' },
            { name: 'CorrectGrossLoadAbidedBy', label: 'Correct Gross Load Abided By?' },
          ].map((item) => (
            <div key={item.name}>
              <span className="block text-sm font-medium text-slate-700 mb-2">{item.label}</span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input type="radio" name={item.name} value={option} className="text-blue-600 focus:ring-blue-500" required />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Safety Equipment Checks ─────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">Safety Equipment Checks</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: 'SeatBeltsServiceable', label: 'Seat Belts Serviceable?' },
            { name: 'FirstAidKitFullInDate', label: 'First Aid Kit Full & In Date?' },
            { name: 'FireExtinguisherFullInDateSecured', label: 'Fire Extinguisher Full / In Date / Secured?' },
            { name: 'EmergencyBreakdownTrianglesInVehicle', label: 'Emergency Breakdown Triangles in Vehicle?' },
            { name: 'AccidentInformationKitInVehicle', label: 'Accident Information Kit in Vehicle?' },
            { name: 'MSDSForChemicalsStoredInVehicle', label: 'MSDS for Chemicals Stored in Vehicle?' },
          ].map((item) => (
            <div key={item.name}>
              <span className="block text-sm font-medium text-slate-700 mb-2">{item.label}</span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input type="radio" name={item.name} value={option} className="text-blue-600 focus:ring-blue-500" required />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Interior & General Checks ─────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">Interior & General Checks</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: 'InteriorClean', label: 'Interior Clean?' },
            { name: 'AreThereAnyLooseItemsInCabArea', label: 'Are There Any Loose Items in Cab Area?' },
            { name: 'PanelCondition', label: 'Panel Condition Good?' },
            { name: 'FuelCardInVehicleNOTExpired', label: 'Fuel Card in Vehicle NOT Expired?' },
          ].map((item) => (
            <div key={item.name}>
              <span className="block text-sm font-medium text-slate-700 mb-2">{item.label}</span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input type="radio" name={item.name} value={option} className="text-blue-600 focus:ring-blue-500" required />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Mechanical & Electrical Checks ─────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">Mechanical & Electrical Checks</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: 'OilLevelCorrect', label: 'Oil Level Correct?' },
            { name: 'CoolantLevelCorrect', label: 'Coolant Level Correct?' },
            { name: 'LampsALLOperative', label: 'Lamps ALL Operative?' },
            { name: 'ElectricalGuagesOperative', label: 'Electrical Gauges Operative?' },
          ].map((item) => (
            <div key={item.name}>
              <span className="block text-sm font-medium text-slate-700 mb-2">{item.label}</span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input type="radio" name={item.name} value={option} className="text-blue-600 focus:ring-blue-500" required />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Odometer Readings ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">Odometer Information</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Odometer Reading (km)</label>
            <input
              type="number"
              name="OdometerReading"
              className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Current odometer reading"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Next Service Due (km)</label>
            <input
              type="number"
              name="NextServiceDue"
              className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Odometer reading for next service"
              required
            />
          </div>
        </div>
      </div>

      {/* ─── Action Required Section ─────────────────────────────────────────── */}
      <div className="border-t pt-4 mt-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Action Required</h4>

        <div className="mb-4">
          <span className="block text-sm font-medium text-slate-700 mb-2">ANY Action Required?</span>
          <div className="flex gap-4">
            {['Yes', 'No'].map((option) => (
              <label key={option} className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="ANYActionRequired"
                  value={option}
                  className="text-blue-600 focus:ring-blue-500"
                  required
                  onChange={(e) => setIsActionRequired(e.target.value === 'Yes')}
                />
                {option}
              </label>
            ))}
          </div>
        </div>

        {isActionRequired && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-md p-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Describe the Action That Needs to be Resolved
              </label>
              <textarea
                name="DescribeTheActionThatNeedsToBeResolved"
                rows={4}
                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
                placeholder="Provide detailed description of the required action..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Upload Photos (if applicable)</label>
              <input type="file" name="UploadAPhoto" multiple accept="image/*" className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              <p className="text-xs text-slate-500 mt-1">You can upload multiple photos to document the issue</p>
            </div>
          </div>
        )}
      </div>
    </BaseInspectionForm>
  );
};