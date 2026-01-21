Case 1: When .der certificate not uploaded

Error:
State: URL_UNREACHABLE, Reason: UNREACHABLE_SSL_VALIDATION_FAILED

Case 2: When .der certificate uploaded

State: URL_ERROR, Reason: ERROR_OTHER, HTTP status code: 403

gateway failed

State: URL_ERROR, Reason: ERROR_NOT_FOUND, HTTP status code: 404

State: URL_UNREACHABLE, Reason: UNREACHABLE_5xx, HTTP status code: 503


Before uploading .der certifcat im getting below error:
State: URL_UNREACHABLE, Reason: UNREACHABLE_SSL_VALIDATION_FAILED

After uploading .der certificate, im getting below error
State: URL_ERROR, Reason: ERROR_OTHER, HTTP status code: 403

