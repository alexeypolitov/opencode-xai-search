# opencode-xai-search

An [OpenCode](https://opencode.ai) plugin that registers a web search provider named `xai`, backed by xAI (Grok) `web_search` and `x_search`. It authenticates with your xAI SuperGrok subscription sign-in. No API key is needed.

## Install

```sh
opencode plugin add github:alexeypolitov/opencode-xai-search#main
```

This follows the `main` branch, so the plugin updates automatically.

## Enable

In `~/.config/opencode/opencode.json`:

```json
{
  "websearch": { "provider": "xai" }
}
```

## Options (optional)

To set options, replace the plain plugin string with an object in the plugins list:

```json
{
  "package": "github:alexeypolitov/opencode-xai-search#main",
  "options": {
    "model": "grok-4.7",
    "effort": "low",
    "maxToolCalls": 4,
    "xSearch": true
  }
}
```

| Option         | Default      | Description                                                  |
| -------------- | ------------ | ------------------------------------------------------------ |
| `model`        | `"grok-4.7"` | The Grok model that runs the search.                         |
| `effort`       | `"low"`      | The reasoning effort level for the model.                    |
| `maxToolCalls` | `4`          | The maximum number of search tool calls for each query.      |
| `xSearch`      | `true`       | Also search X (Twitter) with `x_search`, in addition to `web_search`. |

## Requirements

On each machine, run `/connect` in OpenCode and sign in to xAI (SuperGrok).
