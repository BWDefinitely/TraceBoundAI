"use client";

import { encryptObject, decryptObject } from "./crypto";
import type { AiSettings } from "./ai-settings";

const SETTINGS_STORAGE_KEY = "tracebound-secure-settings";
const SETTINGS_VERSION = "1.0.0";

interface SecureSettings {
  version: string;
  lastModified: string;
  aiSettings: AiSettings;
}

// 保存加密的设置到 localStorage
export async function saveSecureSettings(settings: AiSettings): Promise<void> {
  try {
    const secureData: SecureSettings = {
      version: SETTINGS_VERSION,
      lastModified: new Date().toISOString(),
      aiSettings: settings,
    };
    
    const encrypted = await encryptObject(secureData);
    localStorage.setItem(SETTINGS_STORAGE_KEY, encrypted);
  } catch (err) {
    console.error("保存加密设置失败:", err);
    throw new Error("保存设置失败");
  }
}

// 读取并解密设置
export async function loadSecureSettings(): Promise<AiSettings | null> {
  try {
    const encrypted = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!encrypted) return null;
    
    const secureData = await decryptObject<SecureSettings>(encrypted);
    
    // 版本检查
    if (secureData.version !== SETTINGS_VERSION) {
      console.warn("设置版本不匹配，将重置设置");
      return null;
    }
    
    return secureData.aiSettings;
  } catch (err) {
    console.error("读取加密设置失败:", err);
    // 如果解密失败，可能是数据损坏，清除并返回 null
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    return null;
  }
}

// 删除设置
export function deleteSecureSettings(): void {
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
}

// 检查是否存在设置
export function hasSecureSettings(): boolean {
  return localStorage.getItem(SETTINGS_STORAGE_KEY) !== null;
}

// 导出加密的设置到文件
export async function exportSecureSettings(): Promise<void> {
  try {
    const encrypted = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!encrypted) {
      throw new Error("没有可导出的设置");
    }
    
    const blob = new Blob([encrypted], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `tracebound-settings-${new Date().toISOString().split('T')[0]}.enc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("导出设置失败:", err);
    throw new Error("导出设置失败");
  }
}

// 从文件导入加密的设置
export async function importSecureSettings(file: File): Promise<AiSettings> {
  try {
    // 检查文件类型
    if (!file.name.endsWith('.enc')) {
      throw new Error("请选择 .enc 格式的设置文件");
    }
    
    // 读取文件内容
    const encrypted = await file.text();
    
    if (!encrypted || encrypted.trim().length === 0) {
      throw new Error("文件内容为空");
    }
    
    // 尝试解密验证
    let secureData: SecureSettings;
    try {
      secureData = await decryptObject<SecureSettings>(encrypted);
    } catch (decryptErr) {
      console.error("解密错误:", decryptErr);
      throw new Error("解密失败：文件可能已损坏或密码不正确");
    }
    
    // 版本检查
    if (!secureData.version) {
      throw new Error("设置文件格式不正确：缺少版本信息");
    }
    
    if (secureData.version !== SETTINGS_VERSION) {
      throw new Error(`设置文件版本不兼容（文件版本：${secureData.version}，当前版本：${SETTINGS_VERSION}）`);
    }
    
    // 验证数据结构
    if (!secureData.aiSettings) {
      throw new Error("设置文件格式不正确：缺少AI设置数据");
    }
    
    // 保存到 localStorage
    localStorage.setItem(SETTINGS_STORAGE_KEY, encrypted);
    
    return secureData.aiSettings;
  } catch (err) {
    console.error("导入设置失败:", err);
    // 如果是已知错误，直接抛出
    if (err instanceof Error && err.message.startsWith("解密失败") || 
        err instanceof Error && err.message.startsWith("设置文件") ||
        err instanceof Error && err.message.startsWith("请选择") ||
        err instanceof Error && err.message.startsWith("文件内容")) {
      throw err;
    }
    // 未知错误
    throw new Error(`导入设置失败：${(err as Error).message || "未知错误"}`);
  }
}

// 迁移旧的 IndexedDB 设置到加密存储
export async function migrateFromIndexedDB(oldSettings: AiSettings): Promise<void> {
  try {
    await saveSecureSettings(oldSettings);
    console.log("已将设置迁移到加密存储");
  } catch (err) {
    console.error("迁移设置失败:", err);
    throw err;
  }
}
