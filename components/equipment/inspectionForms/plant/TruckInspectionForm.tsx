'use client';

import { BaseInspectionForm } from '../BaseInspectionForm';
import { PlantFormProps } from '../types';
import { useState } from 'react';
import { getDueStatus } from '@/lib/equipment/dueStatus';

export const TruckInspectionForm = ({ selectedItem }: PlantFormProps) => {
  const [isHiabFitted, setIsHiabFitted] = useState(false);
  const [isActionRequired, setIsActionRequired] = useState(false);

  const existingServiceDueDate = selectedItem.serviceDueDate 
    ? new Date(selectedItem.serviceDueDate).toISOString().split('T')[0]
    : '';

    // Helper function to safely format date for display
  const formatDateForDisplay = (date: Date | string | undefined) => {
    if (!date) return 'Not Set';
    try {
      return new Date(date).toLocaleDateString('en-AU');
    } catch {
      return 'Invalid Date';
    }
  };

  const due = getDueStatus(selectedItem?.serviceDueDate);

  return (
    <BaseInspectionForm title="Truck Inspection Fields" icon="🚛">

      {/* ─── Truck Information ─────────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">
          Truck Information
        </h4>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-slate-700">Truck Name:</span>
              <span className="ml-2 text-slate-600">{selectedItem.name}</span>
            </div>
            <div>
              <span className="font-medium text-slate-700">Auto ID:</span>
              <span className="ml-2 text-slate-600">{selectedItem.autoId}</span>
            </div>            
            <div>
              <span className="font-medium text-slate-700">Registration Number:</span>
              <span className="ml-2 text-slate-600">{selectedItem.registrationNumber || 'Not specified'}</span>
            </div>            
            <div>
              <span className="font-medium text-slate-700">Location:</span>
              <span className="ml-2 text-slate-600">{selectedItem.location}</span>
            </div>
            {/* Add current service due date for reference */}
            <div>
              <span className="font-medium text-slate-700">Current Service Due:</span>
              <span className={`ml-2 ${existingServiceDueDate ? 'text-slate-600' : 'text-amber-600'}`}>
                {formatDateForDisplay(selectedItem.serviceDueDate)}
              </span>
            </div>
            
          </div>
        </div>
      </div>

      {/* ─── Truck Service Information (aligned with Vehicle) ─────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">
          📅 Service Information
        </h4>

        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Service Due Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Current Service Due Date
              </label>
              <input
                type="date"
                name="CurrentServiceDueDate"
                defaultValue={existingServiceDueDate}
                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <div className="mt-2">
                <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${due.className}`}>
                  {due.label}
                </span>
              </div>
            </div>

            {/* Current Service Due (km) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Current Service Due (km)
              </label>
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
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">
          Truck Condition Checks
        </h4>

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
              <span className="block text-sm font-medium text-slate-700 mb-2">
                {item.label}
              </span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={item.name}
                      value={option}
                      className="text-blue-600 focus:ring-blue-500"
                      required
                    />
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
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">
          Safety Equipment Checks
        </h4>

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
              <span className="block text-sm font-medium text-slate-700 mb-2">
                {item.label}
              </span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={item.name}
                      value={option}
                      className="text-blue-600 focus:ring-blue-500"
                      required
                    />
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
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">
          Interior & General Checks
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: 'InteriorClean', label: 'Interior Clean?' },
            { name: 'AreThereAnyLooseItemsInCabArea', label: 'Are There Any Loose Items in Cab Area?' },
            { name: 'PanelCondition', label: 'Panel Condition Good?' },
            { name: 'FuelCardInVehicleNOTExpired', label: 'Fuel Card in Vehicle NOT Expired?' },
          ].map((item) => (
            <div key={item.name}>
              <span className="block text-sm font-medium text-slate-700 mb-2">
                {item.label}
              </span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={item.name}
                      value={option}
                      className="text-blue-600 focus:ring-blue-500"
                      required
                    />
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
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">
          Mechanical & Electrical Checks
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: 'OilLevelCorrect', label: 'Oil Level Correct?' },
            { name: 'CoolantLevelCorrect', label: 'Coolant Level Correct?' },
            { name: 'LampsALLOperative', label: 'Lamps ALL Operative?' },
            { name: 'ElectricalGuagesOperative', label: 'Electrical Gauges Operative?' },
          ].map((item) => (
            <div key={item.name}>
              <span className="block text-sm font-medium text-slate-700 mb-2">
                {item.label}
              </span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={item.name}
                      value={option}
                      className="text-blue-600 focus:ring-blue-500"
                      required
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Hiab Equipment Section ─────────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">
          🏗️ Hiab Equipment
        </h4>

        {/* Hiab Fitted Checkbox */}
        <div className="mb-4">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="HiabFitted"
              value="Yes"
              className="text-blue-600 focus:ring-blue-500"
              onChange={(e) => {
                const checked = e.target.checked;
                setIsHiabFitted(checked);
                const hiabSection = document.getElementById('hiabInspectionSection');
                if (hiabSection) {
                  hiabSection.style.display = checked ? 'block' : 'none';
                }
              }}
            />
            <span className="text-sm font-medium text-slate-700">
              Hiab Fitted? 
            </span>
          </label>
        </div>

        {/* ─── Hiab Inspection Checks (conditionally shown) ─────────────────── */}
        <div id="hiabInspectionSection" style={{ display: 'none' }} className="mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h5 className="text-sm font-semibold text-slate-700 mb-3">
              Hiab Inspection Checks
            </h5>

            {/* Hiab Service Date */}
            <div className="mb-4 bg-white rounded-md p-3 border border-blue-300">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Hiab Service Date
              </label>
              <input
                type="date"
                name="HiabLastServiceDate"
                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required={isHiabFitted} // Only required if Hiab is fitted
              />
              <p className="text-xs text-slate-500 mt-1">
                Date of the next Hiab service/maintenance
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name: 'HiabHydraulicSystemOperational', label: 'Hydraulic System Operational?' },
                { name: 'HiabControlsResponsive', label: 'Controls Responsive?' },
                { name: 'HiabLoadBlockHook', label: 'Load Block/Hook in Good Condition?' },
                { name: 'HiabWinchCable', label: 'Winch Cable Condition Good?' },
                { name: 'HiabOutriggers', label: 'Outriggers/Stabilizers Working?' },
                { name: 'HiabLevelIndicator', label: 'Level Indicator Working?' },
                { name: 'HiabHydraulicLeaks', label: 'No Hydraulic Leaks Visible?' },
              ].map((item) => (
                <div key={item.name}>
                  <span className="block text-sm font-medium text-slate-700 mb-2">
                    {item.label}
                  </span>
                  <div className="flex gap-4">
                    {['Yes', 'No', 'N/A'].map((option) => (
                      <label key={option} className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={item.name}
                          value={option}
                          className="text-blue-600 focus:ring-blue-500"
                          required={isHiabFitted} // ✅ Change this line - only required when Hiab is fitted
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Hiab Load Test */}
            <div className="mt-4 border-t pt-4">
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Hiab Inspection Notes
                </label>
                <textarea
                  name="HiabInspectionNotes"
                  rows={3}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Any specific observations about the Hiab operation, issues found, or maintenance needed..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Odometer Readings ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">
          Odometer Information
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Odometer Reading (km)
            </label>
            <input
              type="number"
              name="OdometerReading"
              className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Current odometer reading"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Next Service Due (km)
            </label>
            <input
              type="number"
              name="NextServiceDue"
              className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Odometer reading for next service"
              required
            />
          </div>
          {/* <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Next Service Due (Date)
            </label>
            <input
              type="date"
              name="NextServiceDueDate"
              className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div> */}
        </div>
      </div>

      {/* ─── Action Required Section ─────────────────────────────────────────── */}
      <div className="border-t pt-4 mt-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">
          Action Required
        </h4>

        <div className="mb-4">
          <span className="block text-sm font-medium text-slate-700 mb-2">
            ANY Action Required?
          </span>
          <div className="flex gap-4">
            {['Yes', 'No'].map((option) => (
              <label key={option} className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="ANYActionRequired"
                  value={option}
                  className="text-blue-600 focus:ring-blue-500"
                  required
                  onChange={(e) => {
                    const isYes = e.target.value === 'Yes';
                    setIsActionRequired(isYes);
                    const actionsSection = document.getElementById('actionsSection');
                    if (actionsSection) {
                      actionsSection.style.display = isYes ? 'block' : 'none';
                    }
                  }}
                />
                {option}
              </label>
            ))}
          </div>
        </div>

        {/* ─── Actions Details (conditionally shown) ─────────────────────────── */}
        <div id="actionsSection" style={{ display: 'none' }} className="mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Describe the Action That Needs to be Resolved
              </label>
              <textarea
                name="DescribeTheActionThatNeedsToBeResolved"
                rows={4}
                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required={isActionRequired} // Only required if action is needed
                placeholder="Provide detailed description of the required action..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Upload Photos (if applicable)
              </label>
              <input
                type="file"
                name="UploadAPhoto"
                multiple
                accept="image/*"
                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                You can upload multiple photos to document the issue
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Additional Comments ────────────────────────────────────────────── */}
      {/* <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Additional Comments
        </label>
        <textarea
          name="additionalComments"
          rows={3}
          className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="Any additional observations or notes..."
        />
      </div> */}
    </BaseInspectionForm>
  );
};