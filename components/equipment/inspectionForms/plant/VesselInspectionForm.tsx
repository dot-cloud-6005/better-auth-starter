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

export const VesselInspectionForm = ({ selectedItem }: PlantFormProps) => {
  const [isActionRequired, setIsActionRequired] = useState(false);

  // Prefills
  const surveyDueStr = formatDate(selectedItem?.vesselSurveyDueDate);
  const cooDueStr = formatDate(selectedItem?.certificateOfOperationDueDate);
  const outboardServiceDueStr = formatDate(selectedItem?.outboardServiceDueDate ?? selectedItem?.serviceDueDate); // renamed & moved

  // Subtle status badges
  const surveyDue = getDueStatus(selectedItem?.vesselSurveyDueDate);
  const cooDue = getDueStatus(selectedItem?.certificateOfOperationDueDate);
  const outboardDue = getDueStatus(selectedItem?.outboardServiceDueDate ?? selectedItem?.serviceDueDate);

  return (
    <BaseInspectionForm title="Vessel Inspection Fields" icon="⛵">
      {/* ─── Vessel Information (prefilled) ─────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">Vessel Information</h4>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-slate-700">Vessel Name:</span>
              <span className="ml-2 text-slate-600">{selectedItem?.name || '-'}</span>
            </div>
            <div>
              <span className="font-medium text-slate-700">Auto ID:</span>
              <span className="ml-2 text-slate-600">{selectedItem?.autoId || '-'}</span>
            </div>
            <div>
              <span className="font-medium text-slate-700">UVI:</span>
              <span className="ml-2 text-slate-600">{selectedItem?.uvi || '-'}</span>
            </div>
            {selectedItem?.outboardType && (
              <div>
                <span className="font-medium text-slate-700">Outboard Type:</span>
                <span className="ml-2 text-slate-600">{selectedItem.outboardType}</span>
              </div>
            )}
            {typeof selectedItem?.outboardQuantity === 'number' && (
              <div>
                <span className="font-medium text-slate-700">Outboard Qty:</span>
                <span className="ml-2 text-slate-600">{selectedItem.outboardQuantity}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Vessel Compliance Information (prefill + badges) ────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">Vessel Compliance Information</h4>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vessel Survey Due Date</label>
              <input
                type="date"
                name="VesselSurveyDueDate"
                defaultValue={surveyDueStr}
                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
              <div className="mt-2">
                <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${surveyDue.className}`}>
                  {surveyDue.label}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Certificate of Operation Due Date</label>
              <input
                type="date"
                name="CertificateOfOperationDueDate"
                defaultValue={cooDueStr}
                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
              <div className="mt-2">
                <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${cooDue.className}`}>
                  {cooDue.label}
                </span>
              </div>
            </div>

            {/* Outboard Service Due Date (moved here, renamed) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Outboard Service Due Date</label>
              <input
                type="date"
                name="OutboardServiceDueDate"
                defaultValue={outboardServiceDueStr}
                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
              <div className="mt-2">
                <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${outboardDue.className}`}>
                  {outboardDue.label}
                </span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Vessel UVI</label>
              <input
                type="text"
                name="VesselUVI"
                defaultValue={selectedItem?.uvi || ''}
                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Unique Vessel Identifier"
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Anchor Equipment ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">
          Anchor Equipment
        </h4>

        <div className="bg-slate-50 rounded-md p-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">
                Anchor in Good Condition
              </span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="AnchorInGoodCondition"
                      value={option}
                      className="text-blue-600 focus:ring-blue-500"
                      required
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">
                Anchor Rope/Chain and Fittings in Sound Condition
              </span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="AnchorRopeChainAndFittingsInSoundCondition"
                      value={option}
                      className="text-blue-600 focus:ring-blue-500"
                      required
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">
                Mooring Ropes in Good Condition
              </span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="MooringRopesInGoodCondition"
                      value={option}
                      className="text-blue-600 focus:ring-blue-500"
                      required
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── First Aid Kit ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">
          First Aid Kit
        </h4>

        <div className="bg-slate-50 rounded-md p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">
                First Aid Kit Fully Stocked and In Date?
              </span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="FirstAidKitFullyStockedAndInDate"
                      value={option}
                      className="text-blue-600 focus:ring-blue-500"
                      required
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                First Aid Kit Expiry Date
              </label>
              <input
                type="date"
                name="FirstAidKitExpiryDate"
                defaultValue={formatDate(selectedItem?.firstAidKitExpiryDate)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Life Saving Equipment ─────────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">
           Life Saving Equipment
        </h4>

        <div className="bg-slate-50 rounded-md p-4 space-y-4">
          {/* Life Jackets */}
          <div className="bg-white rounded-md p-3 border border-slate-200">
            <h5 className="text-sm font-semibold text-slate-700 mb-3">Life Jackets</h5>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Life Jackets in Good Condition and Full Compliment
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="LifeJacketsInGoodConditionAndFullCompliment"
                        value={option}
                        className="text-blue-600 focus:ring-blue-500"
                        required
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Life Jacket Quantity
                </label>
                <select
                  name="LifeJacketQuantity"
                  defaultValue={selectedItem?.lifeJacketQuantity ? String(selectedItem.lifeJacketQuantity) : ''}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                >
                  <option value="">Select quantity...</option>
                  {['1','2','3','4','5','6','7','8'].map((num) => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  PFD&apos;s are Tested & Tagged
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="PFDsAreTestedTagged"
                        value={option}
                        className="text-blue-600 focus:ring-blue-500"
                        required
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Flares */}
          <div className="bg-white rounded-md p-3 border border-slate-200">
            <h5 className="text-sm font-semibold text-slate-700 mb-3">Flares</h5>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Flares in Date & Full Compliment
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="FlaresInDateFullCompliment"
                        value={option}
                        className="text-blue-600 focus:ring-blue-500"
                        required
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Flare Quantity
                </label>
                <select
                  name="FlareQuantity"
                  defaultValue={selectedItem?.flareQuantity ? String(selectedItem.flareQuantity) : ''}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                >
                  <option value="">Select quantity...</option>
                  {['1','2','3','4','5','6','7','8'].map((num) => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Flare Expiry Date
                </label>
                <input
                  type="date"
                  name="FlareExpiry"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* Fire Extinguishers */}
          <div className="bg-white rounded-md p-3 border border-slate-200">
            <h5 className="text-sm font-semibold text-slate-700 mb-3">Fire Extinguishers</h5>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Fire Extinguisher/s in Date & Full Compliment
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="FireExtinguishersInDateFullCompliment"
                        value={option}
                        className="text-blue-600 focus:ring-blue-500"
                        required
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Fire Extinguisher Expiry Date
                </label>
                <input
                  type="date"
                  name="FireExtinguiserExpiry"
                  defaultValue={formatDate(selectedItem?.fireExtinguisherExpiryDate)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* Other Safety Equipment */}
          <div className="bg-white rounded-md p-3 border border-slate-200">
            <h5 className="text-sm font-semibold text-slate-700 mb-3">Other Safety Equipment</h5>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  EPIRB Expiry Date
                </label>
                <input
                  type="date"
                  name="EPIRBExpiryDate"
                  defaultValue={formatDate(selectedItem?.epirbExpiryDate)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
              </div>

              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Torch in Good Condition & Working?
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="TorchInGoodConditionWorking"
                        value={option}
                        className="text-blue-600 focus:ring-blue-500"
                        required
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Air Horn Tested & Confirmed Working?
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="AirHornTestedConfirmedWorking"
                        value={option}
                        className="text-blue-600 focus:ring-blue-500"
                        required
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Light Buoy in Good Condition & Working?
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="LightBuoyInGoodConditionWorking"
                        value={option}
                        className="text-blue-600 focus:ring-blue-500"
                        required
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Outboard Inspection (prefill next service) ──────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">Outboard Inspection</h4>

        <div className="bg-slate-50 rounded-md p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">
                Oil Level Suitable?
              </span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="OilLevelSuitable"
                      value={option}
                      className="text-blue-600 focus:ring-blue-500"
                      required
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">
                Battery Terminals Clean & Secure?
              </span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="BatteryTerminalsCleanSecure"
                      value={option}
                      className="text-blue-600 focus:ring-blue-500"
                      required
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <span className="block text-sm font-medium text-slate-700 mb-2">
                Steering Pivot Tube Has Been Greased Sufficiently?
              </span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="SteeringPivotTubeHasBeenGreasedSufficiently"
                      value={option}
                      className="text-blue-600 focus:ring-blue-500"
                      required
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Action Required Section (state-driven, no DOM) ──────────────── */}
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
                required={isActionRequired}
                placeholder="Provide detailed description of the required action..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Upload Photos (if applicable)</label>
              <input
                type="file"
                name="UploadAPhoto"
                multiple
                accept="image/*"
                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">You can upload multiple photos to document the issue</p>
            </div>
          </div>
        )}
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
          placeholder="Any additional observations or notes about the vessel..."
        />
      </div> */}
    </BaseInspectionForm>
  );
};