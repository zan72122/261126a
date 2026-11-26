import * as THREE from '../../lib/three.module.js';

// Sun direction: crisp early-autumn afternoon sun from east-northeast,
// giving warm 3/4 raking light in the home valley and golden backlighting across the summit cloud sea.
export const SUN_DIR = new THREE.Vector3(0.76, 0.43, -0.48).normalize();

// Key world landmarks (all aligned with terrain & track splines)
export const HOME_CHALET_POS = new THREE.Vector3(-10.5, 0, 4.5);
export const HOME_GIRL_POS = new THREE.Vector3(-2.4, 0, 2.6);
export const HOME_PUPPY_POS = new THREE.Vector3(0.7, 0, 0.9);
export const MAILBOX_POS = new THREE.Vector3(-4.4, 0, 0.6);

export const BOARD_POS = new THREE.Vector3(2.5, 0.25, -9.0);
export const BRIDGE_POS = new THREE.Vector3(36.0, 1.8, -32.0);
export const VILLAGE_POS = new THREE.Vector3(31.0, 2.0, -58.0);
export const SWITCH_1_POS = new THREE.Vector3(26.0, 2.5, -76.0);
export const SIDETRACK_POS = new THREE.Vector3(48.0, 4.2, -122.0);
export const LAKE_POS = new THREE.Vector3(-34.0, 0.5, -188.0);
export const LAKE_PIER_POS = new THREE.Vector3(-42.0, -0.4, -190.0);
export const LAKE_WATER_Y = -1.2;
export const SWITCH_2_POS = new THREE.Vector3(-30.0, 1.2, -214.0);
export const SWITCH_3_POS = new THREE.Vector3(54.0, 24.0, -278.0);
export const LOOKOUT_POS = new THREE.Vector3(84.0, 28.5, -310.0);
export const VIADUCT_POS = new THREE.Vector3(10.0, 44.0, -356.0);
export const SUMMIT_POS = new THREE.Vector3(18.0, 76.0, -395.0);

export const CLOUD_DECK_Y = 47.0;
export const CLOUD_DECK_THICKNESS = 8.0;
