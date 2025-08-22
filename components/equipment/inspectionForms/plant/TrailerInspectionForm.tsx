'use client';

import { useState } from 'react';
import { BaseInspectionForm } from '../BaseInspectionForm';
import { PlantFormProps } from '../types';
import { getDueStatus } from '@/lib/equipment/dueStatus';

export const TrailerInspectionForm = ({ selectedItem }: PlantFormProps) => {
  // Pre-fill date input in YYYY-MM-DD (handles Date | string | undefined)
  const existingServiceDueDate =
    selectedItem.serviceDueDate ? new Date(selectedItem.serviceDueDate).toISOString().split('T')[0] : '';

  const [isActionRequired, setIsActionRequired] = useState(false);
  const due = getDueStatus(selectedItem.serviceDueDate);

  return (
    <BaseInspectionForm title="Trailer Inspection Fields" icon="🚚">
      {/* ─── Trailer Information ─────────────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">Trailer Information</h4>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-slate-700">Trailer Name:</span>
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
              <span className="ml-2 text-slate-600">{selectedItem.location || '-'}</span>
            </div>
            {/* Removed read-only Current Service Due to align with Vehicle/Truck */}
          </div>
        </div>
      </div>

      {/* ─── Service Information (aligned with Vehicle/Truck) ────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">📅 Service Information</h4>

        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Editable current service due date (pre-filled) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Service Due Date</label>
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
            {/* No odometer field for trailers */}
          </div>
        </div>
      </div>

      {/* ─── Trailer Inspection Checklist ─────────────────────────────────── */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">
          Trailer Inspection Checklist
        </h4>

        <div className="space-y-6">
          {/* Electrical & Lighting */}
          <div className="bg-slate-50 rounded-md p-4">
            <h5 className="text-sm font-semibold text-slate-700 mb-3">
              🔌 Electrical & Lighting
            </h5>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Check Lights Are All Operational
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="CheckLightsAreAllOperation2"
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
                  Ensure Plug and Cable Are in Good Condition
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="EnsurePlugAndCableAreInGoodCondition2"
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

          {/* Tyres & Brakes */}
          <div className="bg-slate-50 rounded-md p-4">
            <h5 className="text-sm font-semibold text-slate-700 mb-3">
              🛞 Tyres & Brakes
            </h5>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Is the Tyre Pressure Correct?
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="IsTheTyrePressureCorrect2"
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
                  Brakes Checked and Operational (Fluid Levels)
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="BrakesCheckedAndOperationFluidLevels2"
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

          {/* Coupling & Safety */}
          <div className="bg-slate-50 rounded-md p-4">
            <h5 className="text-sm font-semibold text-slate-700 mb-3">
              🔗 Coupling & Safety Equipment
            </h5>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Ensure Correct Pins Are Used and Serviceable
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="EnsureCorrectPinsAreUsedAndServiceable2"
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
                  Safety Chains and Shackles Are in Good Condition?
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="SafetyChainsAndShacklesAreInGoodCondition2"
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
                  Check Tow Hitch and Safety Latch is in Good Condition and NO Excessive Wear
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="CheckTowHitchAndSafetyLatchIsInGoodConditionAndNOExcessiveWear2"
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
                  Winch & winch rope in good condition?
                </span>
                <div className="flex gap-4">
                  {['Yes', 'No', 'N/A'].map((option) => (
                    <label key={option} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="WinchWinchRopeInGoodCondition"
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

          {/* Structural Integrity */}
          <div className="bg-slate-50 rounded-md p-4">
            <h5 className="text-sm font-semibold text-slate-700 mb-3">
              🏗️ Structural Integrity
            </h5>
            
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">
                Check Sub Frame for Heavy Rust and Corrosion
              </span>
              <div className="flex gap-4">
                {['Yes', 'No', 'N/A'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="CheckSubFrameForHeavyRustAndCorrosion2"
                      value={option}
                      className="text-blue-600 focus:ring-blue-500"
                      required
                    />
                    {option}
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Check for structural integrity and safety concerns
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Action Required Section (state-driven) ───────────────────────── */}
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
          placeholder="Any additional observations or notes about the trailer..."
        />
      </div> */}
    </BaseInspectionForm>
  );
};