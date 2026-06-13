export interface PluginClient {
  app: {
    log(input: {
      body: {
        service: string;
        level: string;
        message: string;
        extra?: Record<string, unknown>;
      };
    }): Promise<void>;
  };
  tui: {
    showToast(input: {
      body: {
        title: string;
        message: string;
        variant: string;
      };
    }): Promise<void>;
  };
  session: {
    create(input: { body: { title: string } }): Promise<unknown>;
    prompt(input: { path: { id: string }; body: unknown }): Promise<unknown>;
    delete(input: { path: { id: string } }): Promise<void>;
    status(input: Record<string, never>): Promise<unknown>;
  };
  config: {
    get(): Promise<unknown>;
  };
}

export type PluginShell = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => {
  quiet(): { text(): Promise<string> };
  text(): Promise<string>;
};

export interface PluginInput {
  client: PluginClient;
  $: PluginShell;
}

export interface PluginHooks {
  tool?: Record<string, unknown>;
  event?: (input: { event: unknown }) => Promise<void>;
  config?: (config: Record<string, unknown>) => Promise<void>;
}

export type Plugin = (input: PluginInput) => Promise<PluginHooks>;
