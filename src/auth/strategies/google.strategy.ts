import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { UsersService } from '../../users/users.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly usersService: UsersService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { id: string; displayName: string; emails?: { value: string }[] },
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('No email from Google'), undefined);

    let user = await this.usersService.findByGoogleId(profile.id);
    if (user) return done(null, user);

    // Check for existing account with same email → link Google ID
    const existing = await this.usersService.findByEmail(email.toLowerCase());
    if (existing) {
      user = await this.usersService.linkGoogleId(existing.id, profile.id);
      return done(null, user);
    }

    // New user via Google
    user = await this.usersService.create({
      full_name: profile.displayName,
      email: email.toLowerCase(),
      google_id: profile.id,
    });
    done(null, user);
  }
}
