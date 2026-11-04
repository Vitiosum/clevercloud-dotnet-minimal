# MinimalSample — ASP.NET Core minimal API on Clever Cloud

> One `Program.cs`, no controller, no NuGet package: the home route prints the operating system, the .NET version, the user and the date of the machine that runs it, and a dozen routes show what minimal APIs do — route groups and endpoint filters, typed results (200, 400, 404), Problem Details, a custom binder. On Clever Cloud the **native .NET runtime** finds the single `.csproj`, publishes it in Release and starts it on port 8080: no Dockerfile, no add-on, one health check variable.

![The home route in a browser, run locally: operating system, .NET version, user name, date and time, in plain text](docs/screenshot-desktop.png)

<img src="docs/screenshot-phone.png" alt="The home route on a phone, run locally, in plain text" width="300">

**Run it yourself.** The hosted demo was taken down after the presales review (November 2026). The steps in [Deploy on Clever Cloud](#deploy-on-clever-cloud) recreate it from scratch in about 5 minutes.

## What ASP.NET Core does here

| Route | Minimal API feature | What you get (checked locally) |
|---|---|---|
| `GET /` | A raw interpolated string from `Environment` | `Operating System`, `.NET version`, `Username`, `Date and Time` (server time, server culture), `text/plain` |
| `GET /plaintext`, `GET /json` | A string becomes `text/plain`, an object becomes JSON | `Hello, World!` · `{"message":"Hello, World!"}` |
| `GET /hello/{name}` | Route parameter | `Hello, Clever!` for `/hello/Clever` |
| `/outer/…` | `MapGroup` four levels deep, two `AddEndpointFilterFactory` on the inner group, `WithTags` | `/outer/inner/innerget`: `I'm more nested. \| nested filter! \| /inner filter! Tags: (null)` |
| `GET /todo/{id}` | `Results<Ok<Todo>, NotFound, BadRequest>` typed results | 1 to 10: `{"id":3,"title":"Walk the dog"}`; 0 or less: 400; above 10: 404 |
| `GET /problem/{problemType}` | `Results.Problem`, `Results.ValidationProblem`, `TypedResults.ValidationProblem` | `application/problem+json`, 500 or 400, with `"traceId":"traceId123"` |
| `POST /todos` | `IBindableFromHttpContext<T>`: the type binds itself | Whatever the body: `{"id":1,"title":"I was bound from IBindableFromHttpContext<TodoBindable>.BindAsync!","isComplete":false}` |
| `GET /null-result` | A handler returning `null` | 500 |

The app logs its process ID at startup, then `Building filter!` and `Running filter!` from the endpoint filters, on stdout: `clever logs` shows them.

## Deploy on Clever Cloud

You need [clever-tools](https://www.clever.cloud/developers/doc/cli/) (`clever login` done) and the ID of the organisation that will own the resources (`orga_…`, shown in the Console). Run the commands from the repo root: `clever create` links the folder to the new app.

```bash
# 1. The app and its size (.NET compiles: dedicated M build instance)
clever create --type dotnet clevercloud-dotnet-minimal --org <org_id> --region par
clever scale --min-flavor nano --max-flavor XS --min-instances 1 --max-instances 2
clever scale --build-flavor M

# 2. Variables
clever env set CC_HEALTH_CHECK_PATH /plaintext

# 3. Deploy
clever deploy
clever open
```

No add-on, no secret, no setup script. Clever Cloud detects the single `.csproj`, builds with `dotnet publish --framework net8.0 --configuration Release` and starts the app on port 8080.

**.NET 8 reaches end of support on 10 November 2026.** The Clever Cloud docs accept `10.0 (LTS)` through `CC_DOTNET_VERSION`. The migration is `<TargetFramework>net10.0</TargetFramework>` plus `clever env set CC_DOTNET_VERSION 10.0`, to be tested with a local .NET 10 SDK first.

## Variables

| Variable | Set by | Role |
|---|---|---|
| `CC_HEALTH_CHECK_PATH` | you | `/plaintext`, which answers `200 Hello, World!`. "If these paths don't return a 2xx response code, the deployment fails." |
| `ASPNETCORE_URLS` | Clever Cloud | `http://0.0.0.0:8080`: Kestrel listens there. The code does not read `PORT` |
| `CC_DOTNET_PROJ` | optional, not needed | Only "If multiple project files are present in your repository"; the single `MinimalSample.csproj` is detected |

## Routes

`/` · `/plaintext` · `/json` · `/hello/{name}` · `/outer/outerget` · `/outer/inner/innerget` · `/outer/inner/group/{groupName}/nested/{nestedName}` · `/todo/{id}` · `GET /todos` and `POST /todos` · `/problem/{plain|object|validation|objectValidation|validationTyped}` (anything else: 404) · `/null-result`.

## Code tour

```
Program.cs                      the whole app: routes, groups, filters, typed results, Problem Details, the binder
MinimalSample.csproj            Microsoft.NET.Sdk.Web, net8.0, nullable and implicit usings on
appsettings.json                log levels, AllowedHosts *
appsettings.Development.json    log levels in Development
Properties/launchSettings.json  the dotnet run profile: http://localhost:5000, https://localhost:5001, Development
```

`Program.cs` keeps its .NET Foundation header (MIT) and its sample name. There is no `.gitignore`: do not commit the `bin/` and `obj/` folders a local build creates.

## Run locally

```bash
dotnet run                                                  # launch profile: http://localhost:5000 and https://localhost:5001
dotnet run --no-launch-profile --urls http://localhost:8302   # one HTTP port, Production, as for the screenshots
```

Requires the .NET 8 SDK.

MIT License.
