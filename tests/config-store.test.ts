import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';

// Mock the entire 'fs' module before importing the module under test
jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
    },
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
  };
});

const { loadConfig, saveConfig, getApiKey, getActiveAiProvider } =
  require('../src/lib/config/store') as typeof import('../src/lib/config/store');

const mockedReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
const mockedWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
const mockedExistsSync = jest.requireMock<typeof import('fs')>('fs').existsSync as jest.Mock;
const mockedMkdirSync = jest.requireMock<typeof import('fs')>('fs').mkdirSync as jest.Mock;

describe('loadConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load and parse existing config file', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        geminiApiKey: 'test-gemini-key',
        jsearchApiKey: 'test-jsearch-key',
      }),
    );

    const config = await loadConfig();

    expect(config).toEqual({
      geminiApiKey: 'test-gemini-key',
      jsearchApiKey: 'test-jsearch-key',
    });
    expect(mockedReadFile).toHaveBeenCalledTimes(1);
  });

  it('should return empty object when config file does not exist', async () => {
    mockedExistsSync.mockReturnValue(false);
    mockedReadFile.mockRejectedValueOnce(new Error('ENOENT'));

    const config = await loadConfig();

    expect(config).toEqual({});
  });

  it('should return empty object on JSON parse error', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFile.mockResolvedValueOnce('invalid json{{{');

    const config = await loadConfig();

    expect(config).toEqual({});
  });
});

describe('saveConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should merge partial config with existing values', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        geminiApiKey: 'existing-key',
        jsearchApiKey: 'existing-jsearch',
      }),
    );
    mockedWriteFile.mockResolvedValueOnce(undefined);

    const result = await saveConfig({ geminiApiKey: 'new-key' });

    // Existing values should be preserved, gemini should be updated
    expect(result.geminiApiKey).toBe('new-key');
    expect(result.jsearchApiKey).toBe('existing-jsearch');

    // Written JSON should contain merged values
    const writtenJson = mockedWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenJson);
    expect(parsed).toEqual({
      geminiApiKey: 'new-key',
      jsearchApiKey: 'existing-jsearch',
    });
  });

  it('should save a new config when no file exists', async () => {
    mockedExistsSync.mockReturnValue(false);
    mockedReadFile.mockResolvedValueOnce('{}');
    mockedWriteFile.mockResolvedValueOnce(undefined);

    const result = await saveConfig({ geminiApiKey: 'brand-new-key' });

    expect(result.geminiApiKey).toBe('brand-new-key');

    const writtenJson = mockedWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenJson);
    expect(parsed).toEqual({ geminiApiKey: 'brand-new-key' });
  });

  it('should strip undefined values before writing', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        geminiApiKey: 'existing-key',
        jsearchApiKey: 'existing-jsearch',
      }),
    );
    mockedWriteFile.mockResolvedValueOnce(undefined);

    await saveConfig({
      geminiApiKey: undefined as unknown as string,
      openrouterApiKey: 'new-key',
    });

    const writtenJson = mockedWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenJson);
    // geminiApiKey should be removed (was undefined), jsearch preserved, openrouter added
    expect(parsed).toEqual({
      jsearchApiKey: 'existing-jsearch',
      openrouterApiKey: 'new-key',
    });
  });

  it('should ensure data directory exists', async () => {
    mockedExistsSync.mockReturnValue(false);
    mockedReadFile.mockResolvedValueOnce('{}');
    mockedWriteFile.mockResolvedValueOnce(undefined);

    await saveConfig({ geminiApiKey: 'key' });

    expect(mockedMkdirSync).toHaveBeenCalledWith(expect.stringContaining('data'), {
      recursive: true,
    });
  });
});

describe('getApiKey', () => {
  const ORIGINAL_JSEARCH = process.env.JSEARCH_API_KEY;

  afterAll(() => {
    if (ORIGINAL_JSEARCH !== undefined) {
      process.env.JSEARCH_API_KEY = ORIGINAL_JSEARCH;
    } else {
      delete process.env.JSEARCH_API_KEY;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.JSEARCH_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  it('should return stored value from config file', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        jsearchApiKey: 'stored-jsearch-key',
      }),
    );

    const key = await getApiKey('jsearchApiKey');

    expect(key).toBe('stored-jsearch-key');
  });

  it('should fall back to environment variable when not in config', async () => {
    mockedExistsSync.mockReturnValue(false);
    mockedReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    process.env.JSEARCH_API_KEY = 'env-jsearch-key';

    const key = await getApiKey('jsearchApiKey');

    expect(key).toBe('env-jsearch-key');
  });

  it('should return undefined when key is not found anywhere', async () => {
    mockedExistsSync.mockReturnValue(false);
    mockedReadFile.mockRejectedValueOnce(new Error('ENOENT'));

    const key = await getApiKey('nimApiKey');

    expect(key).toBeUndefined();
  });

  it('should prefer stored config over environment variable', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        geminiApiKey: 'stored-key',
      }),
    );
    process.env.GEMINI_API_KEY = 'env-key';

    const key = await getApiKey('geminiApiKey');

    expect(key).toBe('stored-key');
  });
});

describe('getActiveAiProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.NIM_API_KEY;
  });

  it('should return gemini when stored in config file', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        geminiApiKey: 'gemini-key',
      }),
    );

    const provider = await getActiveAiProvider();

    expect(provider).toBe('gemini');
  });

  it('should prioritize gemini > openrouter > nim', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        openrouterApiKey: 'openrouter-key',
      }),
    );

    const provider = await getActiveAiProvider();

    expect(provider).toBe('openrouter');
  });

  it('should fall back to process.env when no config file keys exist', async () => {
    mockedExistsSync.mockReturnValue(false);
    mockedReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    process.env.NIM_API_KEY = 'nim-env-key';

    const provider = await getActiveAiProvider();

    expect(provider).toBe('nim');
  });

  it('should return null when no AI API key is configured', async () => {
    mockedExistsSync.mockReturnValue(false);
    mockedReadFile.mockRejectedValueOnce(new Error('ENOENT'));

    const provider = await getActiveAiProvider();

    expect(provider).toBeNull();
  });
});
