"use client";

import { listMaterials, listStories, getMediaBlob, saveMediaBlob } from "./client-store";
import { STORES, idbGetAll, idbPut } from "./idb";
import type { Material, Story } from "./store";

// 导出所有数据为JSON文件
export async function exportAllData(): Promise<void> {
  try {
    // 收集所有数据
    const materials = await listMaterials();
    const stories = await listStories();
    
    // 收集所有媒体文件（转为base64）
    const mediaMap: Record<string, string> = {};
    
    for (const material of materials) {
      if (material.mediaKind === 'photo') {
        const blob = await getMediaBlob(material.id);
        if (blob) {
          const base64 = await blobToBase64(blob);
          mediaMap[material.id] = base64;
        }
      }
    }
    
    // 收集故事的场景图片
    for (const story of stories) {
      if (story.sceneImages) {
        for (const img of story.sceneImages) {
          const blob = await getMediaBlob(img.blobId);
          if (blob) {
            const base64 = await blobToBase64(blob);
            mediaMap[img.blobId] = base64;
          }
        }
      }
    }
    
    const exportData = {
      version: "1.0.0",
      exportDate: new Date().toISOString(),
      materials,
      stories,
      media: mediaMap,
    };
    
    // 创建下载链接
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `tracebound-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return;
  } catch (err) {
    console.error("导出失败:", err);
    throw new Error("导出失败：" + (err as Error).message);
  }
}

// 从JSON文件导入数据
export async function importAllData(file: File): Promise<{ materials: number; stories: number; media: number }> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!data.version || !data.materials || !data.stories) {
      throw new Error("文件格式不正确");
    }
    
    let materialCount = 0;
    let storyCount = 0;
    let mediaCount = 0;
    
    // 导入媒体文件
    if (data.media) {
      for (const [id, base64] of Object.entries(data.media)) {
        try {
          const blob = await base64ToBlob(base64 as string);
          await saveMediaBlob(id, blob);
          mediaCount++;
        } catch (err) {
          console.warn(`导入媒体 ${id} 失败:`, err);
        }
      }
    }
    
    // 导入素材
    if (data.materials) {
      for (const material of data.materials) {
        try {
          await idbPut(STORES.materials, material);
          materialCount++;
        } catch (err) {
          console.warn(`导入素材 ${material.id} 失败:`, err);
        }
      }
    }
    
    // 导入故事
    if (data.stories) {
      for (const story of data.stories) {
        try {
          await idbPut(STORES.stories, story);
          storyCount++;
        } catch (err) {
          console.warn(`导入故事 ${story.id} 失败:`, err);
        }
      }
    }
    
    return { materials: materialCount, stories: storyCount, media: mediaCount };
  } catch (err) {
    console.error("导入失败:", err);
    throw new Error("导入失败：" + (err as Error).message);
  }
}

// Blob转Base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // 移除 data:image/xxx;base64, 前缀
      const base64Data = base64.split(',')[1] || base64;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Base64转Blob
function base64ToBlob(base64: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      // 如果有data URL前缀，提取出来
      const parts = base64.includes(',') ? base64.split(',') : ['data:image/png;base64', base64];
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      resolve(new Blob([u8arr], { type: mime }));
    } catch (err) {
      reject(err);
    }
  });
}
