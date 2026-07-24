# ROLE_PERMISSION_MATRIX

권한 소스: `shared/config/permissions.js` · `roles.js`

| Permission | super_admin | operator | partner_admin | partner_staff | cs_agent | analyst | developer |
|------------|:-----------:|:--------:|:-------------:|:-------------:|:--------:|:-------:|:---------:|
| dashboard.view | * | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| users.view | * | ✓ | | | ✓ | | |
| users.manage | * | ✓ | | | | | |
| users.suspend | * | ✓ | | | | | |
| vehicles.view/manage | * | ✓ | | | | | |
| grids.view/manage | * | ✓ | | | | | |
| community / reports | * | ✓ | | | ✓(process) | | |
| products.view/manage | * | ✓ | ✓ | ✓ | | | |
| benefits.view/manage | * | ✓ | ✓ | ✓ | | | |
| partners.view | * | ✓ | ✓ | ✓ | | | |
| partners.manage | * | | ✓ | | | | |
| settlements.view | * | | ✓ | ✓ | | | |
| settlements.manage | * | | ✓ | | | | |
| support.view/respond | * | view | | | ✓ | | |
| incidents.view/manage | * | view | | | ✓ | | |
| notifications | * | ✓ | | | | | |
| analytics.view | * | ✓ | ✓ | ✓ | | ✓ | ✓ |
| analytics.export | * | | | | | ✓ | |
| system / logs / developers | * | | | | | | ✓ |

`*` = 모든 권한 (`permissions: ["*"]`)

제휴 역할은 추가로 `partnerId` UI 필터가 적용된다.
