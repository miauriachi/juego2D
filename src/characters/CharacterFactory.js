import { LowPolyCharacter } from './LowPolyCharacter.js';

export function createBryan() {
  return new LowPolyCharacter({
    kind: 'Bryan', clothing: 0x303c4a, trousers: 0x282f36,
    skin: 0xc0a28b, hair: 0x382c24, accent: 0x59636a,
  });
}
export function createDoctor() {
  return new LowPolyCharacter({
    kind: 'Doctor', clothing: 0xd0d6cf, trousers: 0x39464a,
    skin: 0xb59b84, hair: 0x51463b, build: 'slim', accent: 0xe0e1d6,
  });
}
export function createNurse() {
  return new LowPolyCharacter({
    kind: 'Nurse', clothing: 0x829faa, trousers: 0x576e79,
    skin: 0xb59b86, hair: 0x46352a, build: 'slim', female: true, accent: 0xc0ced0,
  });
}
export function createReceptionist() {
  return new LowPolyCharacter({
    kind: 'Receptionist', clothing: 0x527e7d, trousers: 0x3b4b50,
    skin: 0x805440, hair: 0x302522, build: 'robust', female: true, accent: 0xcbd1be,
  });
}
export function createOrderly() {
  return new LowPolyCharacter({
    kind: 'Orderly', clothing: 0x6e9090, trousers: 0x4f666c,
    skin: 0xab876d, hair: 0x352e2a, accent: 0xabc0b9,
  });
}

export function createPatientStanding() {
  return new LowPolyCharacter({ kind: 'PatientStanding', clothing: 0x8c8d79,
    trousers: 0x565d60, skin: 0xaf9b84, hair: 0x5f5650, build: 'slim', pose: 'injured' });
}
export function createPatientSitting() {
  return new LowPolyCharacter({ kind: 'PatientSitting', clothing: 0x8c7974,
    trousers: 0x454d57, skin: 0xb19a83, hair: 0x5e5048, pose: 'seated' });
}
export function createPatientLying() {
  return new LowPolyCharacter({ kind: 'PatientLying', clothing: 0xa5b6ad,
    trousers: 0x97a8a1, skin: 0xb4a993, hair: 0x544b41, build: 'slim', pose: 'lying' });
}
export function createChiefDoctor() {
  return new LowPolyCharacter({ kind: 'ChiefDoctor', clothing: 0xd9d9c9,
    trousers: 0x323c47, skin: 0xb69a7f, hair: 0x777871, accent: 0xbfc9c2 });
}
export function createLaboratoryDoctor() {
  return new LowPolyCharacter({ kind: 'LaboratoryDoctor', clothing: 0xd4dad3,
    trousers: 0x495369, skin: 0xba9479, hair: 0x3c302b,
    build: 'slim', female: true, accent: 0x96adb6 });
}
export const CharacterFactory = { createBryan, createDoctor, createNurse, createReceptionist, createOrderly, createLaboratoryDoctor,
  createPatientStanding, createPatientSitting, createPatientLying, createChiefDoctor };
