import { useCallback, useMemo, useState } from 'react';
import type { AppConfig, ProfileSyncPreset, SyncMode } from '../../shared/types';
import { asErrorMessage, suggestProfilesPath, textToEmails } from '../utils';

interface UseConfigResult {
  config: AppConfig | null;
  trustedEmailsText: string;
  mode: SyncMode;
  profileSyncEnabled: boolean;
  canSave: boolean;
  saving: boolean;
  trustConfigured: boolean;
  setTrustedEmailsText: (text: string) => void;
  patchConfig: (patch: Partial<AppConfig>) => void;
  setConfig: (config: AppConfig) => void;
  saveConfig: () => Promise<string | null>;
  currentConfig: () => AppConfig;
  normalizedConfig: (value: AppConfig) => AppConfig;
  applyProfilePreset: (preset: ProfileSyncPreset) => void;
  pickDir: (field: 'sourceAddonsPath' | 'targetAddonsPath' | 'sourceProfilesPath' | 'targetProfilesPath') => Promise<AppConfig | null>;
  pickGitBinary: () => Promise<AppConfig | null>;
}

export function useConfig(): UseConfigResult {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [trustedEmailsText, setTrustedEmailsText] = useState('');
  const [saving, setSaving] = useState(false);

  const mode = config?.mode ?? 'source';
  const profileSyncEnabled = config ? config.profileSyncPreset !== 'addons_only' : false;
  const trustedEmails = useMemo(() => textToEmails(trustedEmailsText), [trustedEmailsText]);

  const trustConfigured = useMemo(() => {
    if (!config || config.mode !== 'client') {
      return true;
    }

    return config.requireSignedCommits || trustedEmails.length > 0;
  }, [config, trustedEmails]);

  const canSave = useMemo(() => {
    if (!config) {
      return false;
    }

    if (!config.repoUrl.trim() || !config.branch.trim()) {
      return false;
    }

    if (mode === 'source' && !config.sourceAddonsPath.trim()) {
      return false;
    }

    if (mode === 'client' && !config.targetAddonsPath.trim()) {
      return false;
    }

    const syncProfiles = config.profileSyncPreset !== 'addons_only';

    if (mode === 'source' && syncProfiles && !config.sourceProfilesPath.trim()) {
      return false;
    }

    if (mode === 'client' && syncProfiles && !config.targetProfilesPath.trim()) {
      return false;
    }

    if (!trustConfigured) {
      return false;
    }

    return true;
  }, [config, mode, trustConfigured]);

  const normalizedConfig = useCallback((value: AppConfig): AppConfig => {
    const syncProfiles = value.profileSyncPreset !== 'addons_only';
    return {
      ...value,
      syncProfiles,
    };
  }, []);

  const patchConfig = useCallback((patch: Partial<AppConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const currentConfig = useCallback((): AppConfig => {
    if (!config) {
      throw new Error('Config is not loaded.');
    }

    return normalizedConfig({
      ...config,
      trustedAuthorEmails: trustedEmails,
    });
  }, [config, trustedEmails, normalizedConfig]);

  const saveConfig = useCallback(async (): Promise<string | null> => {
    if (!config) {
      return null;
    }

    setSaving(true);
    const nextConfig = normalizedConfig(currentConfig());

    try {
      await window.wowSync.saveConfig(nextConfig);
      setConfig(nextConfig);
      return null;
    } catch (error) {
      return `Save failed: ${asErrorMessage(error)}`;
    } finally {
      setSaving(false);
    }
  }, [config, currentConfig, normalizedConfig]);

  const applyProfilePreset = useCallback((preset: ProfileSyncPreset) => {
    if (!config) {
      return;
    }

    const syncProfiles = preset !== 'addons_only';
    const profileField = mode === 'source' ? 'sourceProfilesPath' : 'targetProfilesPath';
    const currentProfilesPath = mode === 'source' ? config.sourceProfilesPath : config.targetProfilesPath;
    const addonsPath = mode === 'source' ? config.sourceAddonsPath : config.targetAddonsPath;
    const suggested = syncProfiles && !currentProfilesPath.trim() ? suggestProfilesPath(addonsPath, preset) : '';

    const nextConfig = {
      ...config,
      profileSyncPreset: preset,
      syncProfiles,
      ...(suggested ? { [profileField]: suggested } : {}),
    } as AppConfig;

    setConfig(nextConfig);
  }, [config, mode]);

  const pickDir = useCallback(async (
    field: 'sourceAddonsPath' | 'targetAddonsPath' | 'sourceProfilesPath' | 'targetProfilesPath',
  ): Promise<AppConfig | null> => {
    if (!config) {
      return null;
    }

    const selected = await window.wowSync.pickDirectory(config[field]);
    if (selected) {
      const nextConfig = {
        ...config,
        [field]: selected,
      } as AppConfig;
      setConfig(nextConfig);
      return nextConfig;
    }

    return null;
  }, [config]);

  const pickGitBinary = useCallback(async (): Promise<AppConfig | null> => {
    if (!config) {
      return null;
    }

    const selected = await window.wowSync.pickGitBinary(config.gitBinaryPath);
    if (selected) {
      const nextConfig = {
        ...config,
        gitBinaryPath: selected,
      };
      setConfig(nextConfig);
      return nextConfig;
    }

    return null;
  }, [config]);

  return {
    config,
    trustedEmailsText,
    mode,
    profileSyncEnabled,
    canSave,
    saving,
    trustConfigured,
    setTrustedEmailsText,
    patchConfig,
    setConfig,
    saveConfig,
    currentConfig,
    normalizedConfig,
    applyProfilePreset,
    pickDir,
    pickGitBinary,
  };
}
