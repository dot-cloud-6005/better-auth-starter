'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

interface CreatePlantInspection {
  plantId: string;
  serviceDate: Date;
  serviceType: string;
  servicedBy: string;
  status: 'pass' | 'fail' | 'needs_repair';
  notes?: string;
  inspectionData?: Record<string, any>;
}

export async function createPlantInspection(data: CreatePlantInspection) {
  try {
    console.log('Creating plant inspection with data:', data);
    
    const supabase = await createClient();

    // First, let's verify the plant exists
    const { data: plantExists, error: plantError } = await supabase
    .schema('equipment')
      .from('plant')
      .select('id, name')
      .eq('id', data.plantId)
      .single();

    if (plantError) {
      console.error('Error checking plant existence:', plantError);
      return { error: `Plant not found: ${plantError.message}` };
    }

    if (!plantExists) {
      console.error('Plant not found with ID:', data.plantId);
      return { error: 'Plant not found' };
    }

    console.log('Plant found:', plantExists);

    // Prepare the insertion data
    const insertData = {
      plant_id: data.plantId,
      service_date: data.serviceDate.toISOString().split('T')[0],
      service_type: data.serviceType,
      serviced_by: data.servicedBy,
      status: data.status,
      notes: data.notes || null,
      inspection_data: data.inspectionData || null,
      created_at: new Date().toISOString()
    };

    console.log('Inserting data:', insertData);

    const { data: result, error } = await supabase
    .schema('equipment')
      .from('plant_service_history')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating plant inspection:', error);
      return { error: `Failed to create inspection: ${error.message}` };
    }

    console.log('Plant inspection created successfully:', result);

    // Update plant's next service date based on inspection result
    if (data.status === 'pass') {
      // Calculate next service date (you can customize this logic)
      const nextServiceDate = new Date(data.serviceDate);
      nextServiceDate.setFullYear(nextServiceDate.getFullYear() + 1); // Default to 1 year

      const { error: updateError } = await supabase
      .schema('equipment')        
        .from('plant')
        .update({
          service_due_date: nextServiceDate.toISOString().split('T')[0],
          plant_status: 'serviceable'
        })
        .eq('id', data.plantId);

      if (updateError) {
        console.error('Error updating plant status:', updateError);
        // Don't fail the whole operation for this
      }
    }

    revalidatePath('/inspections');
    return { data: result };
  } catch (error) {
    console.error('Unexpected error in createPlantInspection:', error);
    return { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function getPlantServiceHistory(plantId?: string) {
  try {
    const supabase = await createClient();

    let query = supabase
      .schema('equipment')
      .from('plant_service_history')
      .select(`
        *,
        plant:plant_id (
          name,
          auto_id,
          plant_groups!fk_plant_group_id (
            name
          )
        )
      `)
      .order('service_date', { ascending: false });

    if (plantId) {
      query = query.eq('plant_id', plantId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching plant service history:', error);
      return { error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('Error in getPlantServiceHistory:', error);
    return { error: 'Failed to fetch plant service history' };
  }
}