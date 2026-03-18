# clevercloud-dotnet-minimal

Minimal ASP.NET Core 8 API example deployed on [Clever Cloud](https://www.clever-cloud.com/).

## Stack

- **Runtime**: .NET 8
- **Framework**: ASP.NET Core Minimal API
- **Hosting**: Clever Cloud (Node.js / .NET app)

## Getting started

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)

### Run locally

```bash
dotnet run
```

The API will be available at `http://localhost:8080`.

## Deploy on Clever Cloud

1. Create a new **.NET** application on [Clever Cloud Console](https://console.clever-cloud.com/)
2. Add the remote and push:

```bash
git remote add clever <your-clever-cloud-git-url>
git push clever main
```

Clever Cloud will automatically detect the `.csproj` and build the app.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port the server listens on | `8080` |

## License

MIT
