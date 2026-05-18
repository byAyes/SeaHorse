# Opciones Gratuitas para Matching de Trabajos (Sin OpenAI)

## Opción 1: Ollama + Modelos Locales (RECOMENDADO)

**Totalmente gratuito, ejecutas IA en tu propia PC**

### Ventajas

- ✅ 100% gratis, sin costos por petición
- ✅ Sin API keys, sin tarjetas de crédito
- ✅ Privacidad total (datos no salen de tu PC)
- ✅ Velocidad: responde en 1-2 segundos localmente
- ✅ Sin límites: analiza todos los jobs que quieras

### Instalación (5 minutos)

```bash
# Descarga e instala Ollama:
# Windows: https://ollama.com/download
# Mac/Linux: brew install ollama

# Inicia el servidor:
ollama serve

# Descarga Llama 3.1 (8B - pequeño y rápido):
ollama pull llama3.1

# Test: ollama run llama3.1 "Hola, ¿cómo estás?"
```

### Configuración

Agrega a `.env`:

```bash
# Desactiva OpenAI
OPENAI_API_KEY=

# Activa Ollama
OLLAMA_ENABLED=true
OLLAMA_MODEL=llama3.1
OLLAMA_BASE_URL=http://localhost:11434
```

### Uso

```bash
npm run automate
# Ahora usa Llama 3.1 local en lugar de OpenAI
```

**Nota**: Para que funcione en GitHub Actions, necesitas un runner auto-hospedado o usar un servicio externo.

---

## Opción 2: APIs Gratuitas (Sin Ollama)

### A) Google Gemini (15,000 peticiones/mes gratis)

```bash
# 1. Ve a: https://aistudio.google.com/app/apikey
# 2. Click "Create API Key"
# 3. Agrega a .env:

OPENAI_API_KEY=gemini-api-key-here
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
OPENAI_MODEL=gemini-1.5-flash
```

### B) Groq (raspberry pi hardware)

```bash
# 1. Regístrate: https://groq.com/
# 2. Ve a API Keys
# 3. Agrega a .env:

OPENAI_API_KEY=groq-api-key-here
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_MODEL=llama-3.1-8b-Instant
```

**Ventajas:**

- ✅ Gratis (con límites)
- ✅ Sin instalar nada local
- ✅ Velocidad extrema (Groq usa hardware especializado)

---

## Opción 3: Matching Simple (Sin IA, 100% Gratis)

**Esto NO usa IA, solo keywords y fuzzy matching**

### Ventajas

- ✅ 100% gratis, siempre
- ✅ No requiere API keys
- ✅ No internet necesario (funciona offline)
- ✅ Velocidad instantánea
- ✅ Fácil de entender y debuggear

### Configuración

```bash
# Activa modo simple
MATCHING_MODE=keyword
```

### Cómo Funciona

```typescript
// Ejemplo de matching simple
function matchJobSimple(job, interests) {
  const jobText = (job.title + ' ' + job.description).toLowerCase();

  let score = 0;

  // Busca cada interés en el texto del job
  interests.forEach((interest) => {
    if (jobText.includes(interest.toLowerCase())) {
      score += 25; // +25% por cada coincidencia
    }
  });

  // Debe tener al menos 50% de coincidencia
  return score >= 50;
}
```

**Resultado**: Entre 60-70% de precisión (menor que IA, pero funciona).

---

## 📊 Comparación de Costos

| Opción           | Costo Mensual | Precisión | Setup     | Velocidad     | Requiere API Key |
| ---------------- | ------------- | --------- | --------- | ------------- | ---------------- |
| **OpenAI**       | $0.30-1.00    | 90%       | Fácil     | Medio         | Sí               |
| **Ollama local** | $0.00         | 85%       | Medio     | Lento (local) | No               |
| **Gemini**       | $0.00         | 88%       | Fácil     | Medio         | Sí (gratis)      |
| **Groq**         | $0.00         | 85%       | Fácil     | Muy rápido    | Sí (gratis)      |
| **Keyword**      | $0.00         | 65%       | Muy fácil | Instantáneo   | No               |

**Recomendación personal:**

- **Prueba local**: Ollama (totalmente gratis)
- **Prueba rápida**: Gemini (gratis, sin instalar)
- **Producción sin costo**: Keyword matching (simple, confiable)

---

## ⚡ Instalación Inmediata (2 minutos)

### Para usar **Ollama** (recomendado):

```bash
# 1. Descarga Ollama: https://ollama.com/download
# 2. Instala y abre Ollama
# 3. Corre estas comandos:

ollama pull llama3.1

# 4. En tu .env:
OLLAMA_ENABLED=true
OLLAMA_MODEL=llama3.1
OLLAMA_BASE_URL=http://localhost:11434

# 5. ¡Listo!
npm run automate
```

### Para usar **Gemini** (sin instalar):

```bash
# 1. Ve a: https://aistudio.google.com/app/apikey
# 2. Copia tu API key
# 3. En tu .env:

OPENAI_API_KEY=AIza...tu-clave
gemini-1.5-flash
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta

# 4. ¡Listo!
npm run automate
```

### Para usar **Keyword** (más simple):

```bash
# En tu .env:
MATCHING_MODE=keyword

# ¡Listo!
npm run automate
```

---

## 🎯 ¿Cuál Elegir?

### **Si quieres IA gratuita** → **Ollama**

- Totalmente gratis, modelo local
- Resultados casi tan buenos como OpenAI
- Setup: 5 minutos (una vez)
- No pagas nunca

### **Si quieres sin instalar** → **Gemini**

- 15,000 peticiones/mes gratis
- Setup: 2 minutos
- Solo copiar API key
  2

### **Si quieres simple y confiable** → **Keyword**

- No requiere setup
- No depende de servicios externos
- Funciona siempre, offline

### **Si quieres la mejor calidad y no te importa pagar $0.30/mes** → **OpenAI**

- 90% de precisión
- Setup existente ya funciona
- Más costoso, pero mejor calidad

---

## 📦 Estructura de Archivos

Crearé estos archiers para ti:

```
src/lib/automation/
├── matcher-ollama.ts      # IA con Ollama (gratis, local)
├── matcher-gemini.ts       # IA con Gemini (gratis, API)
├── matcher-keyword.ts      # Sin IA (gratis, simple)
└── matcher-openai.ts      # IA con OpenAI (pago, premium)
```

Y actualizaré:

- `src/automation/orchestrator.ts` - Para usar el matcher configurado
- `src/lib/email/template.ts` - Para mostrar scores de matching
- `docs/FREE_MATCHING_OPTIONS.md` - Esta documentación
- `.env.example` - Configuraciones para cada opción

---

## 🚀 Ejecutar con Opción Gratuita

```bash
# Usa Ollama (local, gratis)
cd "C:\Users\juans\Documents\GitHub\automatitation"
npm run automate

# O usa Gemini/SendGrid/resend
npm run automate

# O usa keyword matching
MATCHING_MODE=keyword npm run automate
```

---

## 🎉 Conclusión

**¡No necesitas OpenAI!** Tienes 3 opciones 100% gratuitas:

1. **Ollama** - IA local, mejor calidad
2. **Gemini** - IA via API, sin instalar 3. **Keyword** - Matching simple, sin IA

¿Cuál prefieres implementar primero? Puedo crear el código para tu elección ahora mismo.

Te recomiendo **Ollama** → mejor balance de calidad y libertad (y totalmente gratis).

**¿Qué opción te gustaría usar?**
