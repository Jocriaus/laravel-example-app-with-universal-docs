# Request lifecycle

What happens to `PATCH /api/v1/user-groups/5`, from the network to the JSON response.

```
HTTP request
   │
   ▼
routes/api.php ─► routes/v1/modules/userGroup.php        (route match)
   │
   ▼
Middleware
   ├─ ErrorLogMiddleware        (api group: logs any 5xx to the activity log)
   ├─ auth:api                  (JwtGuard: Bearer token -> $request->user(), 401 if invalid)
   └─ module.permission:User Group Management,Update     (403 if the user's group lacks it)
   │
   ▼
FormRequest  UserGroupRequest    (rules(); 422 {success:false,message} on failure)
   │
   ▼
Controller   UserGroupController::updateUserGroup()
   │   merges route params into the validated data, calls the service
   ▼
Service      UserGroupService::updateUserGroupService()
   │   findOrFail, fill, save, ActivityLogHelper::log(...)
   │   returns (object){ success, message }
   ▼
Controller   wraps it: new GlobalResponseResource($response)
   │   catches ModelNotFoundException -> 404, InvalidException -> 400, Exception -> 500
   ▼
JSON  {"success": true, "message": "User group 'HR' (ID: #5) updated successfully!"}
```

## Who does what

**Middleware** decides *whether* the request may run. It never changes data.

**FormRequest** decides whether the *input* is acceptable. It runs before the controller method, so the controller only ever sees valid data through `$request->validated()`.

**Controller** is a translator between HTTP and the service:

- takes validated input plus route parameters,
- calls one service method,
- turns the result into a resource or JSON,
- turns exceptions into status codes.

**Service** is where the work happens: queries, rules ("a user can only belong to one group"), transactions, logging. Services never touch HTTP details such as headers, cookies or status codes. That keeps them callable from commands, jobs and tests.

**Resource** decides what a model looks like in JSON. It is the only place that knows the response field names.

## Where each failure is handled

| Failure | Where it is caught | Status |
|---|---|---|
| Missing / invalid / revoked access token | `auth:api` | 401 |
| Wrong role | `role:` middleware | 403 |
| Missing module permission | `module.permission` | 403 |
| Invalid input | FormRequest `failedValidation()` | 422 |
| Business rule broken (`InvalidException`) | Controller `catch` | 400 |
| Record not found (`ModelNotFoundException`) | Controller `catch` | 404 |
| Anything else | Controller `catch (\Exception)` + `ErrorLogMiddleware` | 500 |

Details and response shapes: [Responses & errors](/architecture/responses-and-errors).
