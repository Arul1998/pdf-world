// Barrel re-export — maintains backward compatibility for all 38+ files importing from '@/lib/pdf-tools'.
// New code should import directly from '@/lib/pdf/' submodules for better tree-shaking.
export * from './pdf/index';
