import { EquipmentInspectionForm } from './equipment/EquipmentInspectionForm';
import { EquipmentInspectable } from './types';

interface EquipmentInspectionFormSelectorProps {
  selectedItem: EquipmentInspectable;
}

export const EquipmentInspectionFormSelector = ({ selectedItem }: EquipmentInspectionFormSelectorProps) => {
  // For now, all equipment uses the same form
  // In the future, you could add equipment-specific forms based on group
  return <EquipmentInspectionForm selectedItem={selectedItem} />;
};