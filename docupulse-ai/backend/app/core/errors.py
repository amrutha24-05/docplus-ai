"""Domain errors. `main.py` maps each to an HTTP status."""


class DocuPulseError(Exception):
    status_code = 500

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ConfigError(DocuPulseError):
    status_code = 503


class DocumentError(DocuPulseError):
    status_code = 400


class NotFoundError(DocuPulseError):
    status_code = 404


class LLMError(DocuPulseError):
    status_code = 502


class AudioError(DocuPulseError):
    status_code = 502
