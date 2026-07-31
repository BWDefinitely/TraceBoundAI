// 简单的加密/解密工具，用于保护敏感配置
// 使用 Web Crypto API

const ENCRYPTION_KEY_NAME = "tracebound-encryption-key";
const SALT = "tracebound-ai-salt-2026"; // 固定盐值

// 生成或获取加密密钥
async function getEncryptionKey(): Promise<CryptoKey> {
  // 从密码派生密钥
  const password = "tracebound-user-settings"; // 可以改为用户自定义密码
  const encoder = new TextEncoder();
  
  // 导入密码作为密钥材料
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  
  // 使用 PBKDF2 派生密钥
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(SALT),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// 加密数据
export async function encryptData(data: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 初始化向量
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encoder.encode(data)
    );
    
    // 将 IV 和加密数据合并，转换为 Base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.error("加密失败:", err);
    throw new Error("加密失败");
  }
}

// 解密数据
export async function decryptData(encryptedData: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const decoder = new TextDecoder();
    
    // 从 Base64 解码
    const combined = new Uint8Array(
      atob(encryptedData)
        .split("")
        .map((c) => c.charCodeAt(0))
    );
    
    // 分离 IV 和加密数据
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encrypted
    );
    
    return decoder.decode(decrypted);
  } catch (err) {
    console.error("解密失败:", err);
    throw new Error("解密失败");
  }
}

// 加密对象
export async function encryptObject<T>(obj: T): Promise<string> {
  const json = JSON.stringify(obj);
  return encryptData(json);
}

// 解密对象
export async function decryptObject<T>(encryptedData: string): Promise<T> {
  const json = await decryptData(encryptedData);
  return JSON.parse(json);
}
