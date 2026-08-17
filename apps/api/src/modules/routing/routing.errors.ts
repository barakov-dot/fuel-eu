import { HttpException, HttpStatus } from '@nestjs/common';

export class RoutingUnavailableException extends HttpException {
  constructor(message = 'Routing service is not configured') {
    super(
      { message, error: 'RoutingUnavailable' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class RoutingTimeoutException extends HttpException {
  constructor(message = 'Routing provider timed out') {
    super({ message, error: 'RoutingTimeout' }, HttpStatus.GATEWAY_TIMEOUT);
  }
}

export class RouteNotFoundException extends HttpException {
  constructor(message = 'No route found between the given points') {
    super({ message, error: 'RouteNotFound' }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class RoutingProviderException extends HttpException {
  constructor(message: string, status = HttpStatus.BAD_GATEWAY) {
    super({ message, error: 'RoutingProviderError' }, status);
  }
}
