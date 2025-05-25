const ytdl = require("@distube/ytdl-core");
const axios = require("axios");

const BASE_URL = (vid) => `https://www.youtube.com/watch?v=${vid}`;

// Função de log aprimorada para depuração
const logDebug = (message, data = null) => {
  console.log(`[DEBUG] ${message}`, data ? data : '');
};

// Filtrar formatos de áudio
const filterFormats = (formats, type) => {
  if (!formats || !Array.isArray(formats)) {
    logDebug("Formatos inválidos recebidos:", formats);
    return [];
  }
  
  if (type === "audioonly") {
    return formats.filter((format) => {
      const mimeType = format.mimeType || format.type;
      return mimeType && mimeType.toLowerCase().includes("audio");
    });
  }
  return formats;
};

// Encontrar formato com maior bitrate
const highestBitrate = (formats) => {
  if (!formats || formats.length === 0) {
    return null;
  }
  
  return formats.reduce((highest, format) => {
    const currentBitrate = parseInt(format.bitrate || 0);
    const highestBitrate = parseInt(highest.bitrate || 0);
    return currentBitrate > highestBitrate ? format : highest;
  }, formats[0]);
};

// Função principal para extrair áudio do YouTube usando ytdl-core
exports.extractFromYtdlCore = async (id, dataType) => {
  try {
    logDebug(`Tentando extrair áudio para ID: ${id} usando ytdl-core`);
    
    let info = await ytdl.getInfo(BASE_URL(id), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Origin": "https://www.youtube.com",
        "Referer": "https://www.youtube.com"
      },
    });
    
    let audioFormats = ytdl.filterFormats(info.formats, "audioonly");
    
    if (!audioFormats || audioFormats.length === 0) {
      logDebug("Nenhum formato de áudio encontrado com ytdl-core");
      throw new Error("Nenhum formato de áudio encontrado.");
    }
    
    if (dataType === "audio") {
      const format = highestBitrate(audioFormats);
      logDebug("Formato de áudio encontrado:", { 
        url: format.url.substring(0, 100) + "...", 
        mimeType: format.mimeType,
        bitrate: format.bitrate
      });
      return format;
    }
  } catch (error) {
    logDebug(`Erro ao extrair com ytdl-core: ${error.message}`);
    throw error;
  }
};

// Função alternativa usando API pública do YouTube Music
exports.extractFromPublicAPI = async (id, dataType) => {
  try {
    logDebug(`Tentando extrair áudio para ID: ${id} usando API pública`);
    
    // Usando uma API pública mais confiável
    const response = await axios.get(`https://pipedapi.kavin.rocks/streams/${id}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json"
      },
      timeout: 10000 // 10 segundos de timeout
    });
    
    if (!response.data || !response.data.audioStreams) {
      logDebug("Resposta inválida da API pública");
      throw new Error("Resposta inválida da API.");
    }
    
    const audioStreams = response.data.audioStreams;
    
    if (!audioStreams || audioStreams.length === 0) {
      logDebug("Nenhum stream de áudio encontrado na API pública");
      throw new Error("Nenhum stream de áudio disponível.");
    }
    
    // Ordenar por bitrate e pegar o melhor
    audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const bestAudio = audioStreams[0];
    
    logDebug("Melhor stream de áudio encontrado:", {
      url: bestAudio.url.substring(0, 100) + "...",
      mimeType: bestAudio.mimeType,
      bitrate: bestAudio.bitrate
    });
    
    return {
      url: bestAudio.url,
      mimeType: bestAudio.mimeType || "audio/webm",
      bitrate: bestAudio.bitrate,
      container: bestAudio.container || "webm"
    };
  } catch (error) {
    logDebug(`Erro ao extrair com API pública: ${error.message}`);
    throw error;
  }
};

// Função de fallback usando Invidious
exports.extractFromInvidious = async (id, dataType) => {
  try {
    logDebug(`Tentando extrair áudio para ID: ${id} usando Invidious`);
    
    // Lista de instâncias Invidious para tentar
    const invidiousInstances = [
      "https://invidious.snopyta.org",
      "https://invidious.kavin.rocks",
      "https://vid.puffyan.us",
      "https://invidious.namazso.eu"
    ];
    
    // Tentar cada instância até uma funcionar
    let lastError = null;
    for (const instance of invidiousInstances) {
      try {
        const { data } = await axios.get(
          `${instance}/api/v1/videos/${id}?fields=adaptiveFormats`,
          {
            timeout: 5000, // 5 segundos de timeout
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
          }
        );
        
        if (!data || !data.adaptiveFormats) {
          continue;
        }
        
        const audioFormats = data.adaptiveFormats.filter(
          format => format.type && format.type.startsWith("audio")
        );
        
        if (audioFormats.length === 0) {
          continue;
        }
        
        // Ordenar por bitrate e pegar o melhor
        audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        const bestAudio = audioFormats[0];
        
        logDebug("Formato de áudio encontrado via Invidious:", {
          url: bestAudio.url.substring(0, 100) + "...",
          type: bestAudio.type,
          bitrate: bestAudio.bitrate
        });
        
        return {
          url: bestAudio.url,
          mimeType: bestAudio.type || "audio/webm",
          bitrate: bestAudio.bitrate,
          container: "webm"
        };
      } catch (error) {
        lastError = error;
        logDebug(`Erro com instância ${instance}: ${error.message}`);
        // Continuar para a próxima instância
      }
    }
    
    // Se chegou aqui, todas as instâncias falharam
    throw lastError || new Error("Todas as instâncias Invidious falharam");
  } catch (error) {
    logDebug(`Erro ao extrair com Invidious: ${error.message}`);
    throw error;
  }
};

// Função principal que tenta todos os métodos em sequência
exports.extractYoutube = async (id, dataType) => {
  logDebug(`Iniciando extração para ID: ${id}, tipo: ${dataType}`);
  
  const extractors = [
    { fn: exports.extractFromYtdlCore, name: "ytdl-core" },
    { fn: exports.extractFromPublicAPI, name: "API pública" },
    { fn: exports.extractFromInvidious, name: "Invidious" }
  ];
  
  let lastError = null;
  
  for (const extractor of extractors) {
    try {
      logDebug(`Tentando extrator: ${extractor.name}`);
      const result = await extractor.fn(id, dataType);
      logDebug(`Extração bem-sucedida com ${extractor.name}`);
      return result;
    } catch (error) {
      lastError = error;
      logDebug(`Falha no extrator ${extractor.name}: ${error.message}`);
      // Continuar para o próximo extrator
    }
  }
  
  // Se chegou aqui, todos os métodos falharam
  logDebug("Todos os métodos de extração falharam");
  throw lastError || new Error("Não foi possível extrair o áudio por nenhum método disponível");
};

// Manter compatibilidade com o código existente
exports.extractFromPipeDaAPI = exports.extractFromPublicAPI;
exports.extractFromBeatbump = async (id, dataType) => {
  logDebug("extractFromBeatbump chamado, redirecionando para extractYoutube");
  return exports.extractYoutube(id, dataType);
};
exports.extractFromAlltube249 = async (id, dataType) => {
  logDebug("extractFromAlltube249 chamado, redirecionando para extractYoutube");
  return exports.extractYoutube(id, dataType);
};
exports.extractFromAlltube250 = async (id, dataType) => {
  logDebug("extractFromAlltube250 chamado, redirecionando para extractYoutube");
  return exports.extractYoutube(id, dataType);
};
exports.extractFromAlltube251 = async (id, dataType) => {
  logDebug("extractFromAlltube251 chamado, redirecionando para extractYoutube");
  return exports.extractYoutube(id, dataType);
};
exports.extractFromYoutubeRaw = async (id, dataType) => {
  logDebug("extractFromYoutubeRaw chamado, redirecionando para extractYoutube");
  return exports.extractYoutube(id, dataType);
};
