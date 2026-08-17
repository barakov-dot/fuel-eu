import { HttpException, HttpStatus } from '@nestjs/common';

export class GeocodingUnavailableException extends HttpException {
  constructor(message = 'Geocoding service is not configured') {
    super(
      { message, error: 'GeocodingUnavailable' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class GeocodingTimeoutException extends HttpException {
  constructor(message = 'Geocoding provider timed out') {
    super({ message, error: 'GeocodingTimeout' }, HttpStatus.GATEWAY_TIMEOUT);
  }
}

export class GeocodingRateLimitedException extends HttpException {
  constructor(message = 'Geocoding provider rate limit reached') {
    super(
      { message, error: 'GeocodingRateLimited' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class GeocodingProviderException extends HttpException {
  constructor(message: string, status = HttpStatus.BAD_GATEWAY) {
    super({ message, error: 'GeocodingProviderError' }, status);
  }
}

export class GeocodingNotFoundException extends HttpException {
  constructor(message = 'No address found for the given coordinates') {
    super({ message, error: 'GeocodingNotFound' }, HttpStatus.NOT_FOUND);
  }
}
