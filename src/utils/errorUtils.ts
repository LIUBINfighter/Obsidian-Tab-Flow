interface ErrorLike {
	message?: string;
}

export function formatError(err: unknown): string {
	try {
		if (err instanceof Error) {
			return err.message;
		}
		const errorLike = err as ErrorLike;
		if (errorLike && typeof errorLike.message === 'string') {
			return errorLike.message;
		}
		return String(err);
	} catch {
		return 'Unknown error';
	}
}
