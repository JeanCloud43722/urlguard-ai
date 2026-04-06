# URLGuard AI – Function & API Reference

**Project:** URLGuard AI – Phishing & URL Security Checker  
**Version:** 8.7  
**Last Updated:** 2026-04-06  
**Stack:** React 19 + TypeScript + Vite + tRPC + Express + MySQL/TiDB + DeepSeek AI

---

## 📋 Table of Contents

1. [Frontend Functions](#frontend-functions)
2. [Backend APIs (tRPC Procedures)](#backend-apis-trpc-procedures)
3. [Hooks & Utilities](#hooks--utilities)
4. [Components](#components)
5. [Database Functions](#database-functions)
6. [External API Integrations](#external-api-integrations)

---

## Frontend Functions

### URL Checker Functions

#### `handleCheckURL(e: React.FormEvent)`
**Location:** `client/src/pages/Home.tsx`  
**Purpose:** Handles URL submission and analysis  
**Parameters:**
- `e: React.FormEvent` – Form submission event

**Behavior:**
1. Prevents default form submission
2. Triggers haptic feedback
3. Validates URL input (non-empty)
4. Calls `checkURLMutation.mutateAsync()`
5. Sets loading state
6. Displays result modal on success
7. Shows error toast on failure

**Return:** `Promise<void>`

**Example:**
```tsx
const handleCheckURL = async (e: React.FormEvent) => {
  e.preventDefault();
  onSubmit(); // Haptic feedback
  if (!urlInput.trim()) {
    toast.error("Please enter a URL");
    return;
  }
  setIsLoading(true);
  try {
    const res = await checkURLMutation.mutateAsync({ url: urlInput });
    setResult(res as CheckResult);
    setShowResultModal(true);
    toast.success("URL analyzed successfully");
  } catch (error) {
    toast.error((error as Error).message);
  } finally {
    setIsLoading(false);
  }
};
```

---

#### `getRiskColor(level: string): string`
**Location:** `client/src/pages/Home.tsx`  
**Purpose:** Maps risk level to Tailwind color class  
**Parameters:**
- `level: string` – Risk level ("safe" | "suspicious" | "dangerous")

**Return:** `string` – Tailwind color class

**Example:**
```tsx
const color = getRiskColor("dangerous"); // Returns "text-red-600"
```

---

#### `getRiskIcon(level: string): React.ReactNode`
**Location:** `client/src/pages/Home.tsx`  
**Purpose:** Returns icon component for risk level  
**Parameters:**
- `level: string` – Risk level

**Return:** `React.ReactNode` – Lucide icon component

**Icons:**
- `"safe"` → `CheckCircle2` (green)
- `"suspicious"` → `AlertTriangle` (yellow)
- `"dangerous"` → `Shield` (red)

---

### History Functions

#### `loadHistory()`
**Location:** `client/src/pages/Home.tsx`  
**Purpose:** Fetches user's URL check history  
**Trigger:** `useEffect` when `showHistory` changes and user is authenticated

**Query:** `trpc.urlChecker.getHistory.useQuery()`  
**Parameters:** `{ limit: 10 }`

**Return:** `Array<CheckResult>`

---

#### `toggleHistory()`
**Location:** `client/src/pages/Home.tsx`  
**Purpose:** Shows/hides history panel  
**Behavior:**
1. Toggles `showHistory` state
2. Triggers haptic feedback
3. Loads history if authenticated

---

### Modal Functions

#### `closeResultModal()`
**Location:** `client/src/pages/Home.tsx`  
**Purpose:** Closes result modal and clears state  
**Behavior:**
1. Sets `showResultModal` to `false`
2. Clears `result` state after animation

---

## Backend APIs (tRPC Procedures)

### URL Checker Router

#### `checkURL(url: string)`
**Location:** `server/routers/urlChecker.ts`  
**Type:** `protectedProcedure`  
**Purpose:** Analyzes URL for phishing threats

**Input Schema:**
```ts
{
  url: string; // URL to analyze
}
```

**Output Schema:**
```ts
{
  id: number;
  url: string;
  normalizedUrl: string;
  riskScore: number; // 0-100
  riskLevel: "safe" | "suspicious" | "dangerous";
  analysis: string; // DeepSeek AI analysis
  indicators: string[]; // Threat indicators
  confidence: number; // 0-100
  createdAt: Date;
}
```

**Process:**
1. Validates URL format
2. Normalizes URL
3. Checks database cache
4. If not cached:
   - Calls DeepSeek AI for analysis
   - Extracts SSL certificate info
   - Detects affiliate parameters
   - Captures screenshot (if dangerous)
5. Stores result in database
6. Returns result to client

**Error Handling:**
- Invalid URL format → `INVALID_URL`
- Network error → `NETWORK_ERROR`
- AI timeout → `AI_TIMEOUT`

---

#### `getHistory(limit: number)`
**Location:** `server/routers/urlChecker.ts`  
**Type:** `protectedProcedure`  
**Purpose:** Retrieves user's URL check history

**Input Schema:**
```ts
{
  limit: number; // Max results (default: 10)
}
```

**Output Schema:**
```ts
Array<CheckResult>
```

**Query:**
```sql
SELECT * FROM urlChecks 
WHERE userId = ? 
ORDER BY createdAt DESC 
LIMIT ?
```

---

#### `deleteCheck(id: number)`
**Location:** `server/routers/urlChecker.ts`  
**Type:** `protectedProcedure`  
**Purpose:** Deletes a check from history

**Input Schema:**
```ts
{
  id: number; // Check ID
}
```

**Output:** `{ success: boolean }`

---

#### `exportHistory(format: "json" | "csv" | "html")`
**Location:** `server/routers/urlChecker.ts`  
**Type:** `protectedProcedure`  
**Purpose:** Exports history in specified format

**Input Schema:**
```ts
{
  format: "json" | "csv" | "html";
}
```

**Output:** `{ url: string }` – Download URL

---

### Authentication Router

#### `auth.me()`
**Location:** `server/routers.ts`  
**Type:** `publicProcedure`  
**Purpose:** Returns current user info

**Output Schema:**
```ts
{
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: Date;
} | null
```

---

#### `auth.logout()`
**Location:** `server/routers.ts`  
**Type:** `protectedProcedure`  
**Purpose:** Logs out current user

**Behavior:**
1. Clears session cookie
2. Returns success response

---

### System Router

#### `system.notifyOwner(title: string, content: string)`
**Location:** `server/routers.ts`  
**Type:** `protectedProcedure`  
**Purpose:** Sends notification to project owner

**Input Schema:**
```ts
{
  title: string;
  content: string;
}
```

**Output:** `{ success: boolean }`

---

## Hooks & Utilities

### `useHapticFeedback()`
**Location:** `client/src/hooks/useHapticFeedback.ts`  
**Purpose:** Provides haptic feedback for interactions

**Returns:**
```ts
{
  onScroll: () => void;
  onSubmit: () => void;
  onTap: () => void;
}
```

**Behavior:**
- Triggers `navigator.vibrate()` on supported devices
- Respects `prefers-reduced-motion` setting
- Provides haptic patterns:
  - Scroll: 10ms pulse
  - Submit: 20ms pulse
  - Tap: [10, 5, 10]ms pattern

---

### `useGlassHaptics(options: { enableHaptics: boolean })`
**Location:** `client/src/hooks/useGlassHaptics.ts`  
**Purpose:** Haptic feedback for glass UI components

**Returns:**
```ts
{
  triggerHaptic: (type: 'tap' | 'hover') => void;
  isSupported: boolean;
}
```

---

### `useAuth()`
**Location:** `client/src/_core/hooks/useAuth.ts`  
**Purpose:** Provides authentication state and methods

**Returns:**
```ts
{
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
}
```

---

### `trpc` Client
**Location:** `client/src/lib/trpc.ts`  
**Purpose:** tRPC client instance for API calls

**Usage:**
```tsx
// Query
const { data, isLoading } = trpc.urlChecker.checkURL.useQuery({ url: "..." });

// Mutation
const mutation = trpc.urlChecker.checkURL.useMutation();
await mutation.mutateAsync({ url: "..." });
```

---

## Components

### UI Components (shadcn/ui)

#### `Button`
**Props:** `variant`, `size`, `disabled`, `onClick`  
**Variants:** `default`, `outline`, `ghost`, `destructive`

#### `Input`
**Props:** `type`, `placeholder`, `value`, `onChange`, `disabled`

#### `Card`
**Props:** `className`, `children`

#### `Dialog`
**Props:** `open`, `onOpenChange`, `children`

---

### Custom Components

#### `BorderGlow`
**Location:** `client/src/components/BorderGlow.tsx`  
**Purpose:** Animated border glow effect with pointer tracking

**Props:**
```ts
{
  children: React.ReactNode;
  glowColor?: string; // HSL format (default: "210 100 50")
  borderRadius?: number; // px (default: 16)
  glowIntensity?: number; // 0-2 (default: 1)
  edgeSensitivity?: number; // 0-100 (default: 50)
  backgroundColor?: string; // hex (default: "#000000")
  animated?: boolean; // (default: true)
}
```

**Features:**
- Pointer-tracking glow effect
- Customizable color and intensity
- GPU-accelerated animations
- 60fps performance

---

#### `GlassCard`
**Location:** `client/src/components/GlassCard.tsx`  
**Purpose:** Glassmorphism card component

**Props:**
```ts
{
  children: React.ReactNode;
  blur?: number; // px (default: 12)
  saturation?: number; // 0-200 (default: 180)
  opacity?: number; // 0-1 (default: 0.15)
  borderRadius?: number; // px (default: 16)
  borderOpacity?: number; // 0-1 (default: 0.4)
  brightness?: number; // 0-200 (default: 100)
  onHoverScale?: number; // 1-1.1 (default: 1)
  enableHaptics?: boolean; // (default: false)
  className?: string;
}
```

**Features:**
- Native CSS `backdrop-filter`
- Accessibility support (reduced motion, transparency)
- Haptic feedback on hover
- Browser fallback for unsupported browsers

---

#### `DotGrid`
**Location:** `client/src/components/DotGrid.tsx`  
**Purpose:** Animated dot grid background

**Props:**
```ts
{
  size?: number; // dot size in px (default: 2)
  spacing?: number; // dot spacing in px (default: 20)
  opacity?: number; // 0-1 (default: 0.3)
  color?: string; // hex (default: "#ffffff")
}
```

---

#### `Aurora`
**Location:** `client/src/components/Aurora.tsx`  
**Purpose:** Aurora borealis background effect

**Props:**
```ts
{
  intensity?: number; // 0-1 (default: 0.5)
  speed?: number; // animation speed (default: 1)
}
```

---

#### `StarBorder`
**Location:** `client/src/components/StarBorder.tsx`  
**Purpose:** Star-shaped border animation

**Props:**
```ts
{
  children: React.ReactNode;
  color?: string; // hex (default: "#00d4ff")
  duration?: number; // ms (default: 3000)
}
```

---

#### `DecryptedText`
**Location:** `client/src/components/DecryptedText.tsx`  
**Purpose:** Text decryption animation effect

**Props:**
```ts
{
  text: string;
  speed?: number; // ms per character (default: 50)
  maxIterations?: number; // (default: 10)
  sequential?: boolean; // (default: false)
  revealDirection?: "start" | "center" | "end"; // (default: "start")
  animateOn?: "view" | "inViewHover"; // (default: "view")
  className?: string;
  encryptedClassName?: string;
}
```

---

#### `ResultModal`
**Location:** `client/src/components/ResultModal.tsx`  
**Purpose:** Displays URL analysis results

**Props:**
```ts
{
  result: CheckResult | null;
  isOpen: boolean;
  onClose: () => void;
}
```

**Features:**
- Risk level color coding
- Detailed analysis display
- Auto-close countdown (5 seconds)
- Export options

---

## Database Functions

### URL Check Queries

#### `createCheck(userId: string, url: string, analysis: CheckResult)`
**Location:** `server/db.ts`  
**Purpose:** Stores URL check in database

**SQL:**
```sql
INSERT INTO urlChecks (userId, url, normalizedUrl, riskScore, riskLevel, analysis, indicators, confidence, createdAt)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
```

---

#### `getCheckById(id: number)`
**Location:** `server/db.ts`  
**Purpose:** Retrieves check by ID

**SQL:**
```sql
SELECT * FROM urlChecks WHERE id = ?
```

---

#### `getUserChecks(userId: string, limit: number)`
**Location:** `server/db.ts`  
**Purpose:** Retrieves user's checks

**SQL:**
```sql
SELECT * FROM urlChecks 
WHERE userId = ? 
ORDER BY createdAt DESC 
LIMIT ?
```

---

#### `deleteCheck(id: number, userId: string)`
**Location:** `server/db.ts`  
**Purpose:** Deletes check (with authorization)

**SQL:**
```sql
DELETE FROM urlChecks 
WHERE id = ? AND userId = ?
```

---

## External API Integrations

### DeepSeek AI

#### `invokeLLM(config: LLMConfig)`
**Location:** `server/_core/llm.ts`  
**Purpose:** Calls DeepSeek AI for URL analysis

**Input:**
```ts
{
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  response_format?: {
    type: "json_schema";
    json_schema: JSONSchema;
  };
}
```

**Output:**
```ts
{
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}
```

**Example:**
```ts
const response = await invokeLLM({
  messages: [
    { role: "system", content: "Analyze this URL for phishing..." },
    { role: "user", content: "https://example.com" }
  ]
});
```

---

### Playwright (Screenshots)

#### `captureScreenshot(url: string)`
**Location:** `server/_core/screenshot.ts`  
**Purpose:** Captures website screenshot

**Return:** `Buffer` – PNG image buffer

**Usage:**
```ts
const buffer = await captureScreenshot(url);
const { url: screenshotUrl } = await storagePut(
  `screenshots/${userId}/${filename}`,
  buffer,
  "image/png"
);
```

---

### S3 Storage

#### `storagePut(key: string, data: Buffer, contentType: string)`
**Location:** `server/storage.ts`  
**Purpose:** Uploads file to S3

**Return:**
```ts
{
  key: string;
  url: string; // Public CDN URL
}
```

---

#### `storageGet(key: string, expiresIn?: number)`
**Location:** `server/storage.ts`  
**Purpose:** Gets presigned URL for S3 object

**Return:**
```ts
{
  key: string;
  url: string; // Presigned URL
}
```

---

### VirusTotal API

#### `checkVirusTotal(url: string)`
**Location:** `server/_core/virustotal.ts`  
**Purpose:** Checks URL against VirusTotal database

**Return:**
```ts
{
  malicious: number;
  suspicious: number;
  undetected: number;
}
```

---

## Animation Functions

### Keyframe Animations

#### `rotate-glow-7s`
**Location:** `client/src/index.css`  
**Purpose:** 7-second rotating glow effect  
**Keyframes:** 360° rotation over 7 seconds

---

#### `fadeInUp`
**Location:** `client/src/index.css`  
**Purpose:** Fade in with upward movement  
**Duration:** 0.6s

---

#### `spring-scale`
**Location:** `client/src/index.css`  
**Purpose:** Spring-like scale animation  
**Easing:** `cubic-bezier(0.25, 1, 0.5, 1)`

---

## Responsive Utilities

### Fluid Typography

#### `text-fluid-h1`
**Size:** `clamp(2rem, 8vw, 3.5rem)`  
**Usage:** Hero headings

#### `text-fluid-body`
**Size:** `clamp(1rem, 2vw, 1.125rem)`  
**Usage:** Body text

---

### Fluid Spacing

#### `px-clamp`
**Padding:** `clamp(1rem, 4vw, 2rem)`

#### `py-clamp`
**Padding:** `clamp(1.5rem, 5vw, 3rem)`

#### `gap-clamp`
**Gap:** `clamp(1rem, 3vw, 2rem)`

---

### Fluid Containers

#### `max-w-fluid-md`
**Width:** `min(90vw, 42rem)`

#### `max-w-fluid-lg`
**Width:** `min(95vw, 64rem)`

---

## Validation Functions

### URL Validation

#### `validateURL(url: string): boolean`
**Location:** `server/routers/urlChecker.ts`  
**Purpose:** Validates URL format

**Checks:**
- Valid URL syntax
- Supported protocols (http, https)
- Non-empty domain

---

### Input Sanitization

#### `sanitizeURL(url: string): string`
**Location:** `server/routers/urlChecker.ts`  
**Purpose:** Normalizes URL

**Transformations:**
- Adds `https://` if missing
- Removes trailing slashes
- Lowercases domain
- Encodes special characters

---

## Performance Utilities

### Memoization

#### `useMemo(callback, deps)`
**Usage:** Memoize expensive calculations

**Example:**
```tsx
const memoizedValue = useMemo(() => expensiveCalculation(), [dep1, dep2]);
```

---

### Lazy Loading

#### `React.lazy()`
**Usage:** Code-split components

**Example:**
```tsx
const ResultModal = React.lazy(() => import('./ResultModal'));
```

---

## Error Handling

### Error Types

#### `InvalidURLError`
**Message:** "Invalid URL format"  
**Status:** 400

#### `NetworkError`
**Message:** "Failed to connect to URL"  
**Status:** 503

#### `AITimeoutError`
**Message:** "AI analysis timeout"  
**Status:** 504

#### `AuthenticationError`
**Message:** "User not authenticated"  
**Status:** 401

---

## Export Functions

### JSON Export

#### `exportAsJSON(data: CheckResult[]): string`
**Location:** `server/routers/urlChecker.ts`  
**Return:** JSON string

---

### CSV Export

#### `exportAsCSV(data: CheckResult[]): string`
**Location:** `server/routers/urlChecker.ts`  
**Return:** CSV string

---

### HTML Export

#### `exportAsHTML(data: CheckResult[]): string`
**Location:** `server/routers/urlChecker.ts`  
**Return:** HTML string with styling

---

## Summary

| Category | Count | Key Functions |
|----------|-------|---|
| Frontend Functions | 5 | handleCheckURL, getRiskColor, loadHistory, toggleHistory, closeResultModal |
| Backend APIs | 6 | checkURL, getHistory, deleteCheck, exportHistory, auth.me, auth.logout |
| Hooks | 3 | useHapticFeedback, useGlassHaptics, useAuth |
| Components | 7 | BorderGlow, GlassCard, DotGrid, Aurora, StarBorder, DecryptedText, ResultModal |
| Database Functions | 4 | createCheck, getCheckById, getUserChecks, deleteCheck |
| External APIs | 3 | DeepSeek AI, Playwright, S3 Storage, VirusTotal |
| Animations | 3 | rotate-glow-7s, fadeInUp, spring-scale |
| Utilities | 10+ | Responsive, Validation, Performance, Error Handling, Export |

---

**Last Updated:** 2026-04-06  
**Maintained By:** URLGuard AI Development Team  
**For External Prompts:** Use this document to generate optimized prompts for feature development, bug fixes, and performance improvements.
